import { test } from 'node:test';
import assert from 'node:assert/strict';
import { configuration } from '../src/worker.mjs';
import { randomValue, hash } from '../src/store.mjs';
import { fixture } from './fixture.mjs';
const start=()=>({operation:'authenticate',proofHash:randomValue(),state:randomValue(),redirect:'http://127.0.0.1:54001/oauth/callback'});
test('fails closed on non-HTTPS, ambiguous RP and missing server trust configuration',()=>{
  const f=fixture();for(const origin of ['http://calendar-auth.example.test','https://calendar-auth.example.test/','https://calendar-auth.example.test:8443','https://localhost','https://user:pass@calendar-auth.example.test'])assert.throws(()=>configuration({...f.env,PASSKEY_ORIGIN:origin}));
  assert.throws(()=>configuration({...f.env,PASSKEY_RP_ID:'example.test'}));assert.throws(()=>configuration({...f.env,RATE_LIMIT_SECRET:''}));f.sqlite.close();
});
test('serves a 404 and safe page headers without leaking credentials',async()=>{
  const f=fixture();let r=await f.handler(new Request(f.env.PASSKEY_ORIGIN+'/missing'));assert.equal(r.status,404);
  r=await f.handler(new Request(f.env.PASSKEY_ORIGIN+'/passkeys'));assert.equal(r.status,200);assert.match(r.headers.get('content-security-policy'),/frame-ancestors 'none'/);assert.equal(r.headers.get('referrer-policy'),'no-referrer');assert.equal(r.headers.get('cache-control'),'no-store');f.sqlite.close();
});
test('rejects callback substitution, extra fields, browser cross-origin and missing browser origin',async()=>{
  const f=fixture();for(const redirect of ['http://localhost:54001/oauth/callback','https://127.0.0.1:54001/oauth/callback','http://127.0.0.1:54001/other','http://127.0.0.1:54001/oauth/callback?code=bad','http://127.0.0.1:80/oauth/callback','http://127.0.0.1:54001/oauth/callback#bad'])assert.equal((await f.request('/api/start',{...start(),redirect})).status,400);
  assert.equal((await f.request('/api/start',{...start(),uid:'victim',assurance:true})).status,400);
  assert.equal((await f.request('/api/start',start(),{Origin:'https://evil.example.test'})).status,400);
  const response=await (await f.request('/api/start',start())).json();assert.equal((await f.request('/api/options',{ticket:response.ticket},{Origin:''})).status,400);f.sqlite.close();
});
test('requires verified full-factor identity for registration and limits request attempts durably',async()=>{
  const f=fixture();assert.equal((await f.request('/api/start',{...start(),operation:'register',idToken:'forged'})).status,400);
  f.identity.verify=async()=>({uid:'alice',validSince:0,hasTotp:true,hasPassword:true,fullFactor:false});assert.equal((await f.request('/api/start',{...start(),operation:'register',idToken:'first-factor'})).status,400);
  for(let i=0;i<28;i++)await f.request('/api/start',start());assert.equal((await f.request('/api/start',start())).status,429);assert.equal(f.sqlite.prepare('SELECT max(used) AS count FROM request_limits').get().count,31);f.sqlite.close();
});
test('expired and malformed WebAuthn submissions burn challenges and cannot be replayed',async()=>{
  const f=fixture();const flow=await(await f.request('/api/start',start())).json();const bad={ticket:flow.ticket,response:{id:'abc',rawId:'abc',type:'public-key',clientExtensionResults:{},response:{clientDataJSON:'e30',authenticatorData:'e30',signature:'e30',userHandle:'abc'}}};
  assert.equal((await f.request('/api/finish',bad)).status,400);assert.equal((await f.store.flow(flow.ticket)).status,'verifying');assert.equal((await f.request('/api/finish',bad)).status,400);
  const later=await(await f.request('/api/start',start())).json();f.advance(300001);assert.equal((await f.request('/api/options',{ticket:later.ticket})).status,400);f.sqlite.close();
});
test('completion exchange needs the exact proof and code and is consumed atomically',async()=>{
  const f=fixture(),proof=randomValue(),input={...start(),proofHash:await hash(proof)};const created=await(await f.request('/api/start',input)).json();
  const now=Date.now();await f.store.claim(created.ticket,now);await f.store.complete(created.ticket,'alice','synthetic-credential',randomValue(),now);const flow=await f.store.flow(created.ticket);
  assert.equal(await f.store.consume(flow.ticket,flow.completion_code,await hash(randomValue()),now),null);
  const results=await Promise.all([f.store.consume(flow.ticket,flow.completion_code,await hash(proof),now),f.store.consume(flow.ticket,flow.completion_code,await hash(proof),now)]);assert.equal(results.filter(Boolean).length,1);f.sqlite.close();
});
test('concurrent removals cannot remove the last passkey and rotation advances the server gate',async()=>{
  const f=fixture(),now=Date.now();await f.store.account('alice',now,0);
  for(const id of ['credential-one','credential-two'])f.sqlite.prepare("INSERT INTO credentials(id,uid,public_key,counter,device_type,backed_up,label,created_at) VALUES(?,'alice','synthetic-public-key',0,'singleDevice',0,'Test',?)").run(id,now);
  const results=await Promise.allSettled([f.store.remove('alice','credential-one',false,now),f.store.remove('alice','credential-two',false,now)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal((await f.store.list('alice')).length,1);
  const rotated=await f.store.rotate('alice',0,Math.floor(now/1000)+1);assert.equal(rotated.epoch,1);await assert.rejects(f.store.rotate('alice',0,0));f.sqlite.close();
});
test('session status distinguishes revocation from an unavailable identity service',async()=>{
  const f=fixture();f.identity.verify=async()=>{throw Error('REVOKED');};assert.equal((await f.request('/api/session',{idToken:'synthetic-old-token'})).status,401);
  f.identity.verify=async()=>{throw Error('PROVIDER_UNAVAILABLE');};assert.equal((await f.request('/api/session',{idToken:'synthetic-old-token'})).status,503);f.sqlite.close();
});
test('a password-only identity cannot add a passkey while its native password endpoint lacks MFA',async()=>{
  const f=fixture();try{
    f.identity.verify=async()=>({uid:'alice',authTime:Math.floor(Date.now()/1000),validSince:0,hasTotp:false,hasPassword:true,fullFactor:false,google:false});
    assert.equal((await f.request('/api/start',{...start(),operation:'register',idToken:'synthetic-password-only'})).status,400);
    assert.equal(f.errors.at(-1).message,'NATIVE_FACTOR_REQUIRED');assert.equal(f.sqlite.prepare('SELECT count(*) AS n FROM credentials').get().n,0);
  }finally{f.sqlite.close();}
});
