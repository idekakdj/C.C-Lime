import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from '../../node_modules/playwright/index.mjs';
import { randomValue, hash, decode, encode } from '../src/store.mjs';
import { fixture } from './fixture.mjs';
// A real Chromium WebAuthn ceremony, synthetic identities, memory-only SQLite;
// this deliberately does not claim physical Windows Hello or live Firebase evidence.
test('real virtual-authenticator registration and discoverable login work, signed assertions cannot be replayed',{timeout:30000},async()=>{
  const f=fixture(),browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{}),timeout:10000});
  try{
    const context=await browser.newContext(),page=await context.newPage();
    const failures=[];
    await context.route('https://calendar-auth.example.test/**',async route=>{
      const original=route.request();const h=await original.allHeaders();h['cf-connecting-ip']='192.0.2.2';
      const response=await f.handler(new Request(original.url(),{method:original.method(),headers:h,...(original.method()==='POST'?{body:original.postData()}: {})}));
      if(response.status>=400)failures.push(`${new URL(original.url()).pathname}:${response.status}:origin=${h.origin??'absent'}`);
      await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()});
    });
    let callbacks=[];await context.route('http://127.0.0.1:54001/**',async route=>{callbacks.push(new URL(route.request().url()));await route.fulfill({status:200,body:'Returned to synthetic desktop'});});
    const cdp=await context.newCDPSession(page);await cdp.send('WebAuthn.enable');
    const {authenticatorId}=await cdp.send('WebAuthn.addVirtualAuthenticator',{options:{protocol:'ctap2',transport:'internal',hasResidentKey:true,hasUserVerification:true,isUserVerified:true,automaticPresenceSimulation:true}});
    async function ceremony(operation){
      const proof=randomValue(),state=randomValue(),input={operation,proofHash:await hash(proof),state,redirect:'http://127.0.0.1:54001/oauth/callback',...(operation==='register'?{idToken:'synthetic-verified-totp',label:'Virtual test device'}:{})};
      const response=await f.request('/api/start',input);assert.equal(response.status,200,await response.clone().text());const launch=await response.json();
      await page.goto(launch.url,{timeout:5000});await page.getByRole('button',{name:'Continue with passkey'}).click();
      try { await page.waitForURL('http://127.0.0.1:54001/**',{timeout:6000}); }
      catch { throw Error(`Virtual ${operation} failed: ${await page.getByRole('status').textContent()} (${failures.join(', ')}; ${f.errors.at(-1)?.message})`); }
      const callback=callbacks.at(-1);assert.equal(callback.searchParams.get('state'),state);
      return{launch,proof,code:callback.searchParams.get('code')};
    }
    const registered=await ceremony('register');let result=await f.request('/api/exchange',{ticket:registered.launch.ticket,code:registered.code,proof:registered.proof});assert.deepEqual(await result.json(),{operation:'registered'});
    const credentials=await f.store.list('alice');assert.equal(credentials.length,1);assert.equal(credentials[0].label,'Virtual test device');
    const signed=await ceremony('authenticate');result=await f.request('/api/exchange',{ticket:signed.launch.ticket,code:signed.code,proof:signed.proof});assert.deepEqual(await result.json(),{operation:'authenticated',uid:'alice',customToken:'synthetic-issued-custom-token'});
    assert.equal((await f.request('/api/exchange',{ticket:signed.launch.ticket,code:signed.code,proof:signed.proof})).status,400);
    await cdp.send('WebAuthn.setUserVerified',{authenticatorId,isUserVerified:false});
    const proof=randomValue(),launch=await(await f.request('/api/start',{operation:'authenticate',proofHash:await hash(proof),state:randomValue(),redirect:'http://127.0.0.1:54001/oauth/callback'})).json();
    const options=await(await f.request('/api/options',{ticket:launch.ticket})).json();assert.equal(options.options.userVerification,'required');
    await cdp.send('WebAuthn.setUserVerified',{authenticatorId,isUserVerified:true});
    for(const variant of ['origin','challenge','type','signature','userHandle','unknown','noUV']){
      f.advance(60001);
      const launch=await(await f.request('/api/start',{operation:'authenticate',proofHash:await hash(randomValue()),state:randomValue(),redirect:'http://127.0.0.1:54001/oauth/callback'})).json();
      const {options}=await(await f.request('/api/options',{ticket:launch.ticket})).json();
      await page.goto(launch.url,{timeout:5000});
      const generateAssertion=async options=>{
        const dec=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
        const enc=v=>btoa(String.fromCharCode(...new Uint8Array(v))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
        const c=await navigator.credentials.get({publicKey:{...options,challenge:dec(options.challenge),timeout:3000,userVerification:'preferred'}});
        const r=c.response;return{id:c.id,rawId:enc(c.rawId),type:'public-key',clientExtensionResults:c.getClientExtensionResults(),response:{clientDataJSON:enc(r.clientDataJSON),authenticatorData:enc(r.authenticatorData),signature:enc(r.signature),userHandle:enc(r.userHandle)}};
      };
      const evaluated=await cdp.send('Runtime.evaluate',{expression:`(${generateAssertion.toString()})(${JSON.stringify(options)})`,awaitPromise:true,returnByValue:true,userGesture:true});
      if(evaluated.exceptionDetails)throw Error(`Virtual ${variant} assertion: ${evaluated.exceptionDetails.exception?.description??evaluated.exceptionDetails.text}`);
      const assertion=evaluated.result.value;
      if(['origin','challenge','type'].includes(variant)){
        const data=JSON.parse(new TextDecoder().decode(decode(assertion.response.clientDataJSON)));
        data[variant]=variant==='origin'?'https://evil.example.test':variant==='challenge'?randomValue():'webauthn.create';
        assertion.response.clientDataJSON=encode(new TextEncoder().encode(JSON.stringify(data)));
      }else if(variant==='signature'){const bytes=decode(assertion.response.signature);bytes[bytes.length-1]^=1;assertion.response.signature=encode(bytes);}
      else if(variant==='userHandle')assertion.response.userHandle=randomValue();
      else if(variant==='unknown'){assertion.id=randomValue();assertion.rawId=assertion.id;}
      else if(variant==='noUV'){const bytes=decode(assertion.response.authenticatorData);bytes[32]&=~4;assertion.response.authenticatorData=encode(bytes);}
      const denied=await f.request('/api/finish',{ticket:launch.ticket,response:assertion});assert.equal(denied.status,400,variant);
      assert.equal((await f.store.flow(launch.ticket)).status,'verifying',variant+' consumes challenge before rejecting');
      if(variant==='noUV')assert.match(f.errors.at(-1).message,/user verif/i,'UV rejected before signature acceptance');
    }
    await context.close();
  }finally{await browser.close();f.sqlite.close();}
});
