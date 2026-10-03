import fs from 'node:fs';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, collection, setDoc } from 'firebase/firestore';
import { randomUUID } from 'node:crypto';
import { FirestoreCloud } from '../../src/main/cloud';
import { item } from '../fixtures';
// @ts-expect-error Staging helper intentionally uses Node JavaScript.
import { passkeyRulesCandidate } from '../../scripts/passkey-rules-candidate.mjs';
let env:RulesTestEnvironment;
const projectId='demo-cc-lime-passkey';
beforeAll(async()=>{env=await initializeTestEnvironment({projectId,firestore:{host:'127.0.0.1',port:8080,rules:passkeyRulesCandidate(fs.readFileSync('cloud/firestore.rules','utf8'))}});});
beforeEach(async()=>{await env.clearFirestore();await env.withSecurityRulesDisabled(async context=>{await setDoc(doc(context.firestore(),'users/alice/records/fixture'),{ownerId:'alice',payload:{title:'Synthetic private fixture'}});await setDoc(doc(context.firestore(),'authSecurity/alice'),{epoch:2,min_auth_time:1,valid_since:1});});});
afterAll(async()=>{await env?.cleanup();});
const now=()=>Math.floor(Date.now()/1000);
function account(provider:string,proof?:object,extra:object={},user='alice'){
  return env.authenticatedContext(user,{email_verified:true,auth_time:now(),firebase:{sign_in_provider:provider,...(provider==='password'?{sign_in_second_factor:'totp'}:{})},...(proof?{cc_lime_passkey:proof}:{}),...extra} as any).firestore();
}
const valid=()=>({v:1,epoch:2,valid_since:1,until:now()+3500});
it.each(['password','google.com','custom'])('accepts full %s proof with a current server gate',async provider=>{
  const db=account(provider,provider==='custom'?valid():undefined);await assertSucceeds(getDoc(doc(db,'users/alice/records/fixture')));await assertSucceeds(getDocs(collection(db,'users/alice/records')));
  const b64=(value:unknown)=>Buffer.from(JSON.stringify(value)).toString('base64url');
  // Emulator transport only. Production never accepts unsigned tokens.
  const token=`${b64({alg:'none',typ:'JWT'})}.${b64({iss:`https://securetoken.google.com/${projectId}`,aud:projectId,sub:'alice',user_id:'alice',email_verified:true,iat:now(),exp:now()+3600,auth_time:now(),firebase:{sign_in_provider:provider,...(provider==='password'?{sign_in_second_factor:'totp'}:{})},...(provider==='custom'?{cc_lime_passkey:valid()}:{})})}.`;
  const cloud=new FirestoreCloud(projectId,'alice',async()=>token,'http://127.0.0.1:8080'),value=item();
  await expect(cloud.commit({id:randomUUID(),recordId:value.id,value,base:null,baseVersion:null,order:1,state:'pending',attempts:0})).resolves.toMatchObject({sequence:1});
  expect((await cloud.get(value.id))?.value).toEqual(value);
});
it.each([
  {},{v:1,epoch:2,valid_since:1,until:1},{v:1,epoch:1,valid_since:1,until:9999999999},
  {v:1,epoch:2,valid_since:0,until:9999999999},{v:1,epoch:2,valid_since:1,until:9999999999},
  {v:1,epoch:'2',valid_since:1,until:9999999999},
])('denies invalid custom assurance %j',async proof=>{await assertFails(getDoc(doc(account('custom',proof),'users/alice/records/fixture')));});
it('rejects client gate reads/writes, first-factor password, phone/anonymous and forged top-level flags',async()=>{
  const db=account('custom',valid());await assertFails(getDoc(doc(db,'authSecurity/alice')));await assertFails(setDoc(doc(db,'authSecurity/alice'),{epoch:2,min_auth_time:0,valid_since:1}));
  for(const provider of ['password','phone','anonymous']){const db=account(provider,undefined,{firebase:{sign_in_provider:provider},mfaCompleted:true,passkeyVerified:true});await assertFails(getDoc(doc(db,'users/alice/records/fixture')));}
  await assertFails(getDoc(doc(account('custom',valid(),{},'bob'),'users/alice/records/fixture')));
});
it('server epoch rotation invalidates an already-issued passkey token and cutoff invalidates native sessions',async()=>{
  const passkey=account('custom',valid()),totp=account('password');await assertSucceeds(getDoc(doc(passkey,'users/alice/records/fixture')));
  await env.withSecurityRulesDisabled(async context=>setDoc(doc(context.firestore(),'authSecurity/alice'),{epoch:3,min_auth_time:1,valid_since:1}));
  await assertFails(getDoc(doc(passkey,'users/alice/records/fixture')));await assertSucceeds(getDoc(doc(totp,'users/alice/records/fixture')));
  await env.withSecurityRulesDisabled(async context=>setDoc(doc(context.firestore(),'authSecurity/alice'),{epoch:3,min_auth_time:now()+1,valid_since:1}));
  await assertFails(getDoc(doc(totp,'users/alice/records/fixture')));
});
it('refuses deriving a candidate if the ownership predicate has drifted',()=>{expect(()=>passkeyRulesCandidate('changed predicate')).toThrow('Ownership predicate changed');});
