import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair, exportPKCS8, jwtVerify } from 'jose';
import { FirebaseIdentity, boundedFetch } from '../src/identity.mjs';
const project='demo-cc-lime',email=`gateway@${project}.iam.gserviceaccount.com`;
test('custom tokens are really signed, bind the server UID/epoch, and expire in two minutes',async()=>{
  const key=await generateKeyPair('RS256',{extractable:true});
  const identity=new FirebaseIdentity({FIREBASE_PROJECT_ID:project,FIREBASE_SIGNER_EMAIL:email,FIREBASE_SIGNER_PRIVATE_KEY:await exportPKCS8(key.privateKey)});
  identity.account=async uid=>({uid,validSince:10});identity.gate=async()=>({fields:{epoch:{integerValue:'2'},valid_since:{integerValue:'10'},min_auth_time:{integerValue:'10'}}});
  const token=await identity.issue('alice',10,{revoked_at:null},2);
  const {payload}=await jwtVerify(token,key.publicKey,{issuer:email,subject:email,audience:'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',algorithms:['RS256']});
  assert.equal(payload.uid,'alice');assert.equal(payload.exp-payload.iat,120);assert.deepEqual(payload.claims.cc_lime_passkey,{v:1,epoch:2,valid_since:10,until:payload.iat+3600});
  await assert.rejects(identity.issue('alice',10,{revoked_at:Date.now()},2));await assert.rejects(identity.issue('alice',9,{revoked_at:null},2));await assert.rejects(identity.issue('alice',10,{revoked_at:null},1));
});
test('malformed or stale server gate fields fail closed',async()=>{
  const identity=new FirebaseIdentity({FIREBASE_PROJECT_ID:project});
  for(const gate of [null,{fields:{}},{fields:{epoch:{integerValue:'nan'},valid_since:{integerValue:'1'},min_auth_time:{integerValue:'0'}}},{fields:{epoch:{integerValue:'1'},valid_since:{integerValue:'1'},min_auth_time:{integerValue:'100'}}}]){identity.gate=async()=>gate;await assert.rejects(identity.checkGate('alice',1,1,20));}
});
test('publishing cannot roll back gate version, revocation cutoff or password revocation floor',async()=>{
  const identity=new FirebaseIdentity({FIREBASE_PROJECT_ID:project});identity.gate=async()=>({updateTime:'2026-10-03T00:00:00.000000Z',fields:{epoch:{integerValue:'2'},valid_since:{integerValue:'20'},min_auth_time:{integerValue:'100'}}});identity.accessToken=async()=>'synthetic-server-bearer';
  await assert.rejects(identity.publishGate('alice',1,0,20));await assert.rejects(identity.publishGate('alice',2,0,19));
  const original=globalThis.fetch;let request;
  globalThis.fetch=async(url,options)=>{request={url,body:JSON.parse(options.body)};return new Response('{}');};
  try{await identity.publishGate('alice',3,90,20);assert.equal(request.body.fields.min_auth_time.integerValue,'100');assert.equal(request.body.fields.epoch.integerValue,'3');assert.match(request.url,/currentDocument.updateTime=/);}
  finally{globalThis.fetch=original;}
});
test('provider lookup refuses password-backed passkey access when native TOTP has been removed',async()=>{
  const identity=new FirebaseIdentity({FIREBASE_PROJECT_ID:project,PILOT_UIDS:JSON.stringify(['alice'])});
  identity.lookup=async()=>({localId:'alice',emailVerified:true,providerUserInfo:[{providerId:'password'}],mfaInfo:[]});
  await assert.rejects(identity.account('alice'),/NATIVE_FACTOR_REQUIRED/);
  identity.lookup=async()=>({localId:'alice',emailVerified:true,providerUserInfo:[{providerId:'password'}],mfaInfo:[{totpInfo:{}}]});assert.equal((await identity.account('alice')).hasTotp,true);
  identity.lookup=async()=>({localId:'alice',emailVerified:true,providerUserInfo:[{providerId:'google.com'}],mfaInfo:[]});assert.equal((await identity.account('alice')).hasPassword,false);
});
test('only a successful, structurally valid empty lookup proves deletion; outages and malformed replies do not',async()=>{
  const identity=new FirebaseIdentity({FIREBASE_PROJECT_ID:project});identity.accessToken=async()=>'synthetic-server-token';const original=globalThis.fetch;
  try{
    for(const body of ['{}','{"users":[]}']){globalThis.fetch=async()=>new Response(body);assert.equal(await identity.lookup('alice'),null);}
    for(const body of ['null','[]','{"error":{"message":"Private provider detail"}}','{"users":"invalid"}','{"users":[{"localId":"bob"}]}']){globalThis.fetch=async()=>new Response(body);await assert.rejects(identity.lookup('alice'));}
    for(const status of [400,404,429,503]){globalThis.fetch=async()=>new Response('{}',{status});await assert.rejects(identity.lookup('alice'),/PROVIDER_UNAVAILABLE/);}
  }finally{globalThis.fetch=original;}
});
test('bounded provider transport rejects oversized streaming replies and accepts empty successful gate deletion',async()=>{
  const original=globalThis.fetch;try{
    globalThis.fetch=async()=>new Response(new ReadableStream({start(controller){controller.enqueue(new Uint8Array(131073));controller.close();}}));
    await assert.rejects(boundedFetch('https://firestore.googleapis.com/synthetic',{method:'GET'}),/PROVIDER_UNAVAILABLE/);
    globalThis.fetch=async()=>new Response(null,{status:204});assert.deepEqual(await boundedFetch('https://firestore.googleapis.com/synthetic',{method:'DELETE'}),{});
  }finally{globalThis.fetch=original;}
});
