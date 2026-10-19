import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { build } from '../../node_modules/esbuild/lib/main.js';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { chromium } from '../../node_modules/playwright/index.mjs';
import { randomValue, hash, D1Store } from '../src/store.mjs';
import { reconcileDeletedAccounts } from '../src/cleanup.mjs';
test('Workers runtime/D1 execute real browser registration and login with synthetic server identity',{timeout:45000},async()=>{
  const bundle=await build({entryPoints:['tests/runtime-worker.mjs'],bundle:true,platform:'browser',format:'esm',target:'es2022',write:false});
  const origin='https://calendar-auth.example.test';
  const worker=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-10-01',d1Databases:{DB:'test'},bindings:{PASSKEY_ORIGIN:origin,PASSKEY_RP_ID:'calendar-auth.example.test',FIREBASE_PROJECT_ID:'demo-cc-lime',RATE_LIMIT_SECRET:'synthetic-runtime-limit-secret-at-least-32-chars'},d1Persist:false,cachePersist:false,telemetry:{enabled:false},cf:false}));
  let browser;
  try{
    const db=await worker.getD1Database('DB');await db.exec(fs.readFileSync(new URL('../migrations/0001.sql',import.meta.url),'utf8').replaceAll('\n',' '));
    const post=(path,body)=>worker.dispatchFetch(origin+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,'CF-Connecting-IP':'192.0.2.3'},body:JSON.stringify(body)});
    browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{}),timeout:10000});const context=await browser.newContext(),page=await context.newPage();
    await context.route(origin+'/**',async route=>{const r=route.request(),headers=await r.allHeaders();headers['cf-connecting-ip']='192.0.2.4';const response=await worker.dispatchFetch(r.url(),{method:r.method(),headers,...(r.method()==='POST'?{body:r.postData()}: {})});await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()});});
    let callback;await context.route('http://127.0.0.1:54001/**',async route=>{callback=new URL(route.request().url());await route.fulfill({status:200,body:'Synthetic desktop callback'});});
    const cdp=await context.newCDPSession(page);await cdp.send('WebAuthn.enable');await cdp.send('WebAuthn.addVirtualAuthenticator',{options:{protocol:'ctap2',transport:'internal',hasResidentKey:true,hasUserVerification:true,isUserVerified:true,automaticPresenceSimulation:true}});
    for(const operation of ['register','authenticate']){
      const proof=randomValue(),state=randomValue();const created=await post('/api/start',{operation,proofHash:await hash(proof),state,redirect:'http://127.0.0.1:54001/oauth/callback',...(operation==='register'?{idToken:'synthetic-verified-totp'}:{})});assert.equal(created.status,200,await created.clone().text());const launch=await created.json();
      await page.goto(launch.url,{timeout:5000});await page.getByRole('button',{name:'Continue with passkey'}).click();try{await page.waitForURL('http://127.0.0.1:54001/**',{timeout:7000});}catch{throw Error('Workers ceremony: '+await page.getByRole('status').textContent());}
      assert.equal(callback.searchParams.get('state'),state);
      const exchanged=await post('/api/exchange',{ticket:launch.ticket,code:callback.searchParams.get('code'),proof});assert.equal(exchanged.status,200,await exchanged.clone().text());const result=await exchanged.json();assert.equal(result.operation,operation==='register'?'registered':'authenticated');if(operation==='authenticate')assert.equal(result.customToken,'synthetic-runtime-token');
    }
    await context.close();
    const store=new D1Store(db),deletedAt=Date.now();let gateErased=false;
    const cleanupIdentity={lookup:async()=>null,publishGate:async()=>{},eraseGate:async()=>{gateErased=true;}};
    assert.equal((await reconcileDeletedAccounts(store,cleanupIdentity,deletedAt)).pending,0);
    assert.equal((await store.list('alice')).length,0);assert.equal((await db.prepare('SELECT count(*) AS n FROM flows').first()).n,0);
    await assert.rejects(store.account('alice',deletedAt,0),/REVOKED/);
    assert.equal((await reconcileDeletedAccounts(store,cleanupIdentity,deletedAt+86400000)).purged,1);assert.equal(gateErased,true);
  }finally{await browser?.close();await worker.dispose();}
});
