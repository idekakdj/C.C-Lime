import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import { D1Store } from '../src/store.mjs';
import { createHandler } from '../src/worker.mjs';
export function fixture() {
  const sqlite=new DatabaseSync(':memory:');sqlite.exec(fs.readFileSync(new URL('../migrations/0001.sql',import.meta.url),'utf8'));
  const db={prepare(sql){return{bind(...values){return{async first(){return sqlite.prepare(sql).get(...values)??null;},async all(){return{results:sqlite.prepare(sql).all(...values)};},async run(){return sqlite.prepare(sql).run(...values);}};}};},async batch(statements){return Promise.all(statements.map(s=>s.run()));}};
  let time=Date.now(),revoked=0;
  const gates=new Map();
  const identity={async verify(token){if(token!=='synthetic-verified-totp')throw Error('IDENTITY');return{uid:'alice',authTime:Math.floor(time/1000),validSince:revoked,hasTotp:true,hasPassword:true,fullFactor:true,google:false};},async account(uid){if(uid!=='alice')throw Error('IDENTITY');return{uid,validSince:revoked,hasTotp:true,hasPassword:true};},async publishGate(uid,epoch,minimum,validSince){gates.set(uid,{epoch,minimum,validSince});},async issue(uid,validSince,_credential,epoch){const gate=gates.get(uid);if(uid!=='alice'||validSince!==revoked||gate?.epoch!==epoch||Math.floor(time/1000)<gate.minimum)throw Error('REVOKED');return'synthetic-issued-custom-token';}};
  const env={PASSKEY_ORIGIN:'https://calendar-auth.example.test',PASSKEY_RP_ID:'calendar-auth.example.test',FIREBASE_PROJECT_ID:'demo-cc-lime',RATE_LIMIT_SECRET:'synthetic-rate-limit-secret-at-least-32-characters',DB:db};
  const errors=[],store=new D1Store(db),handler=createHandler(env,{store,identity,now:()=>time,onFailure:error=>errors.push(error)});
  const request=async(path,body,headers={})=>handler(new Request(env.PASSKEY_ORIGIN+path,{method:'POST',headers:{'Content-Type':'application/json','CF-Connecting-IP':'192.0.2.1',Origin:env.PASSKEY_ORIGIN,...headers},body:JSON.stringify(body)}));
  return{db,sqlite,store,env,identity,handler,request,errors,advance:ms=>{time+=ms;},revoke:()=>{revoked=Math.floor(time/1000)+1;}};
}
