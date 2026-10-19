import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './fixture.mjs';
import {reconcileDeletedAccounts} from '../src/cleanup.mjs';
import {randomValue} from '../src/store.mjs';
const seed=async f=>{
  await f.store.account('alice',Date.now(),20);
  f.sqlite.prepare("INSERT INTO credentials(id,uid,public_key,counter,device_type,backed_up,label,created_at) VALUES('synthetic-credential','alice','synthetic-public-key',0,'singleDevice',0,'Test',?)").run(Date.now());
  await f.store.createFlow({ticket:randomValue(),operation:'register',proof_hash:randomValue(),redirect:'http://127.0.0.1:54001/oauth/callback',state:randomValue(),uid:'alice',auth_time:1,valid_since:20,label:'Test',challenge:randomValue(),expires_at:Date.now()+300000});
};
test('confirmed identity deletion purges credentials/flows, retains a denial gate for 24h, then removes its tombstone',async()=>{
  const f=fixture();try{
    await seed(f);let deletedGate=0;f.identity.lookup=async()=>null;f.identity.eraseGate=async uid=>{assert.equal(uid,'alice');deletedGate++;};
    const now=Date.now();assert.deepEqual(await reconcileDeletedAccounts(f.store,f.identity,now),{checked:1,purged:0,pending:0});
    assert.equal((await f.store.list('alice')).length,0);assert.equal(f.sqlite.prepare('SELECT count(*) AS n FROM flows').get().n,0);
    assert.equal(f.sqlite.prepare('SELECT epoch FROM accounts').get().epoch,1);await assert.rejects(f.store.account('alice',now,20),/REVOKED/);
    assert.equal(deletedGate,0);assert.equal((await reconcileDeletedAccounts(f.store,f.identity,now+86400000)).purged,1);assert.equal(deletedGate,1);
    assert.equal(f.sqlite.prepare('SELECT count(*) AS n FROM accounts').get().n,0);
  }finally{f.sqlite.close();}
});
test('disabled/unverified identities and failed lookups are never mistaken for deletion',async()=>{
  const f=fixture();try{
    await seed(f);for(const user of [{localId:'alice',disabled:true},{localId:'alice',emailVerified:false}]){
      f.identity.lookup=async()=>user;assert.equal((await reconcileDeletedAccounts(f.store,f.identity,Date.now())).pending,0);assert.equal((await f.store.list('alice')).length,1);
    }
    f.identity.lookup=async()=>{throw Error('PROVIDER_UNAVAILABLE');};assert.equal((await reconcileDeletedAccounts(f.store,f.identity,Date.now())).pending,1);assert.equal((await f.store.list('alice')).length,1);
  }finally{f.sqlite.close();}
});
test('failed gate publication/erasure leaves a durable tombstone and retries without resurrecting credentials',async()=>{
  const f=fixture();try{
    await seed(f);f.identity.lookup=async()=>null;const publish=f.identity.publishGate;f.identity.publishGate=async()=>{throw Error('PROVIDER_UNAVAILABLE');};
    const now=Date.now();assert.equal((await reconcileDeletedAccounts(f.store,f.identity,now)).pending,1);assert.equal((await f.store.list('alice')).length,0);
    f.identity.publishGate=publish;f.identity.eraseGate=async()=>{throw Error('PROVIDER_UNAVAILABLE');};assert.equal((await reconcileDeletedAccounts(f.store,f.identity,now+86400000)).pending,1);
    assert.equal(f.sqlite.prepare('SELECT deleted_at FROM accounts').get().deleted_at,now);f.identity.eraseGate=async()=>{};
    assert.equal((await reconcileDeletedAccounts(f.store,f.identity,now+86400001)).purged,1);
  }finally{f.sqlite.close();}
});
