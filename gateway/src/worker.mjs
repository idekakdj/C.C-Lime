import { z } from 'zod';
import { generateRegistrationOptions, generateAuthenticationOptions, verifyRegistrationResponse, verifyAuthenticationResponse } from '@simplewebauthn/server';
import { D1Store, randomValue, encode, decode, hash } from './store.mjs';
import { FirebaseIdentity } from './identity.mjs';
import { page, browserScript, styles } from './web.mjs';
import { reconcileDeletedAccounts } from './cleanup.mjs';
const handle=z.string().regex(/^[A-Za-z0-9_-]{43}$/),uid=z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const startSchema=z.object({operation:z.enum(['register','authenticate']),proofHash:handle,state:handle,
  redirect:z.string().max(100),idToken:z.string().min(1).max(16384).optional(),label:z.string().trim().min(1).max(60).default('Passkey')}).strict();
const ticketSchema=z.object({ticket:handle}).strict();
const exchangeSchema=z.object({ticket:handle,code:handle,proof:handle}).strict();
const managementSchema=z.object({idToken:z.string().min(1).max(16384),credentialId:z.string().regex(/^[A-Za-z0-9_-]{1,2048}$/).optional()}).strict();
const finishSchema=z.object({ticket:handle,response:z.object({id:z.string().min(1).max(2048),rawId:z.string().min(1).max(2048),type:z.literal('public-key'),response:z.object({clientDataJSON:z.string().min(1).max(8192),attestationObject:z.string().max(32768).optional(),authenticatorData:z.string().max(8192).optional(),signature:z.string().max(8192).optional(),userHandle:z.string().max(1024).nullable().optional(),transports:z.array(z.enum(['usb','nfc','ble','internal','hybrid','cable','smart-card'])).max(8).optional()}).strict(),clientExtensionResults:z.object({}).passthrough(),authenticatorAttachment:z.enum(['platform','cross-platform']).optional()}).strict()}).strict();
const headers={ 'Cache-Control':'no-store', 'Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff',
  'Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  'Permissions-Policy':'camera=(), microphone=(), geolocation=(), publickey-credentials-create=(self), publickey-credentials-get=(self)',
  'Strict-Transport-Security':'max-age=31536000; includeSubDomains' };
function json(value,status=200){return new Response(JSON.stringify(value),{status,headers:{...headers,'Content-Type':'application/json'}});}
function text(value,type,status=200){return new Response(value,{status,headers:{...headers,'Content-Type':type}});}
export function configuration(env) {
  let origin;try{origin=new URL(env.PASSKEY_ORIGIN);}catch{throw Error('CONFIGURATION');}
  if(origin.protocol!=='https:'||origin.origin!==env.PASSKEY_ORIGIN||origin.username||origin.password||origin.port||origin.hostname!==env.PASSKEY_RP_ID||!origin.hostname.includes('.')||/^(localhost|127\.|\[)/.test(origin.hostname))throw Error('CONFIGURATION');
  if(!/^[a-z0-9][a-z0-9-]{4,61}[a-z0-9]$/.test(env.FIREBASE_PROJECT_ID)||typeof env.RATE_LIMIT_SECRET!=='string'||env.RATE_LIMIT_SECRET.length<32)throw Error('CONFIGURATION');
  return{origin:origin.origin,rpID:origin.hostname};
}
async function body(request,schema){
  if(request.headers.get('content-type')?.split(';')[0]!=='application/json'||Number(request.headers.get('content-length')??0)>65536)throw Error('BODY');
  const reader=request.body?.getReader();if(!reader)throw Error('BODY');let size=0,value='';const decoder=new TextDecoder('utf-8',{fatal:true});
  try{while(true){const{done,value:chunk}=await reader.read();if(done)break;size+=chunk.length;if(size>65536){await reader.cancel();throw Error('BODY');}value+=decoder.decode(chunk,{stream:true});}value+=decoder.decode();return schema.parse(JSON.parse(value));}finally{reader.releaseLock();}
}
function callback(redirect,state,code){const url=new URL(redirect);url.searchParams.set('state',state);url.searchParams.set('code',code);return url.href;}
function validateRedirect(value){const u=new URL(value);if(u.protocol!=='http:'||u.hostname!=='127.0.0.1'||!u.port||Number(u.port)<1024||Number(u.port)>65535||u.pathname!=='/oauth/callback'||u.search||u.hash||u.username||u.password||u.href!==value)throw Error('CALLBACK');}

export function createHandler(env,dependencies={}) {
  const store=dependencies.store??new D1Store(env.DB),identity=dependencies.identity??new FirebaseIdentity(env),now=dependencies.now??(()=>Date.now());
  return async request=>{
    const url=new URL(request.url);
    if(!['/passkeys','/passkeys.js','/passkeys.css','/api/start','/api/options','/api/finish','/api/exchange','/api/credentials','/api/remove','/api/revoke-sessions','/api/session'].includes(url.pathname))return text('Page not found.','text/plain',404);
    try{
      const config=configuration(env);if(url.origin!==config.origin||url.search)throw Error('ORIGIN');
      if(request.method==='GET'){
        if(url.pathname==='/passkeys')return text(page,'text/html; charset=utf-8');
        if(url.pathname==='/passkeys.js')return text(browserScript,'text/javascript; charset=utf-8');
        if(url.pathname==='/passkeys.css')return text(styles,'text/css; charset=utf-8');
        return json({error:'Method not allowed.'},405);
      }
      if(request.method!=='POST')return json({error:'Method not allowed.'},405);
      const origin=request.headers.get('origin');
      if(origin&&origin!==config.origin||['cross-site','same-site'].includes(request.headers.get('sec-fetch-site')??''))throw Error('ORIGIN');
      if(['/api/options','/api/finish'].includes(url.pathname)&&origin!==config.origin)throw Error('ORIGIN');
      const timestamp=now(),window=Math.floor(timestamp/60000),ip=request.headers.get('cf-connecting-ip');
      if(!ip||ip.length>64)throw Error('CLIENT');
      const macKey=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.RATE_LIMIT_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
      const ipKey=encode(new Uint8Array(await crypto.subtle.sign('HMAC',macKey,new TextEncoder().encode(ip))));
      await store.takeLimit(`ip:${ipKey}:${window}`,30,(window+1)*60000,timestamp);
      const day=Math.floor(timestamp/86400000);await store.takeLimit(`global:${day}`,10000,(day+1)*86400000,timestamp);
      if(['/api/credentials','/api/remove','/api/revoke-sessions','/api/session'].includes(url.pathname)){
        const input=await body(request,managementSchema),user=await identity.verify(input.idToken,url.pathname!=='/api/session');
        if(!user.fullFactor&&!user.google)throw Error('FULL_FACTOR_REQUIRED');
        await store.takeLimit(`uid:${await hash(user.uid)}:${window}`,10,(window+1)*60000,timestamp);
        const account=await store.account(user.uid,timestamp,user.validSince);
        if(user.passkeyEpoch!==undefined&&user.passkeyEpoch!==account.epoch)throw Error('REVOKED');
        if(url.pathname==='/api/session'){if(input.credentialId)throw Error('BODY');return json({current:true});}
        if(url.pathname==='/api/credentials'){
          if(input.credentialId)throw Error('BODY');const rows=await store.list(user.uid);return json({credentials:rows.map(c=>({id:c.id,label:c.label,createdAt:c.created_at,lastUsedAt:c.last_used_at}))});
        }
        if(url.pathname==='/api/remove'){
          if(!input.credentialId)throw Error('BODY');await store.remove(user.uid,input.credentialId,user.hasTotp,now());
        }else if(input.credentialId)throw Error('BODY');
        const rotated=await store.rotate(user.uid,account.epoch,url.pathname==='/api/revoke-sessions'?Math.floor(now()/1000)+1:account.min_auth_time);
        await identity.publishGate(user.uid,rotated.epoch,rotated.min_auth_time,user.validSince);
        return json({done:true});
      }
      if(url.pathname==='/api/start'){
        const input=await body(request,startSchema);validateRedirect(input.redirect);
        let account=null,credentials=[];
        if(input.operation==='register'){
          if(!input.idToken)throw Error('IDENTITY');account=await identity.verify(input.idToken);uid.parse(account.uid);
          // A passkey alone does not stop a stolen password adding a new native TOTP.
          if(account.hasPassword&&!account.hasTotp)throw Error('NATIVE_FACTOR_REQUIRED');
          const existing=await store.list(account.uid);const history=await store.db.prepare('SELECT count(*) AS count FROM credentials WHERE uid=?').bind(account.uid).first();
          if((account.hasTotp||history.count>0)&&!account.fullFactor)throw Error('FULL_FACTOR_REQUIRED');
          if(!account.fullFactor&&!account.google&&account.hasPassword!==true)throw Error('IDENTITY');
          if(existing.length>=5)throw Error('CAPACITY');credentials=existing;
          await store.takeLimit(`uid:${await hash(account.uid)}:${window}`,10,(window+1)*60000,timestamp);
          const stored=await store.account(account.uid,timestamp,account.validSince);
          if(account.passkeyEpoch!==undefined&&account.passkeyEpoch!==stored.epoch)throw Error('REVOKED');
          account.userHandle=stored.user_handle;
        }else if(input.idToken)throw Error('BODY');
        const ticket=randomValue();
        const options=account?await generateRegistrationOptions({rpName:'C.C. Lime',rpID:config.rpID,userName:'C.C. Lime account',userDisplayName:'C.C. Lime account',userID:decode(account.userHandle),attestationType:'none',timeout:120000,
          authenticatorSelection:{residentKey:'required',userVerification:'required'},supportedAlgorithmIDs:[-7,-257],excludeCredentials:credentials.map(c=>({id:c.id}))})
          :await generateAuthenticationOptions({rpID:config.rpID,userVerification:'required',timeout:120000});
        await store.createFlow({ticket,operation:input.operation,proof_hash:input.proofHash,redirect:input.redirect,state:input.state,uid:account?.uid??null,auth_time:account?.authTime??null,valid_since:account?.validSince??null,label:input.label,challenge:options.challenge,expires_at:account?Math.min(timestamp+300000,(account.authTime+300)*1000):timestamp+300000});
        return json({ticket,url:`${config.origin}/passkeys#${ticket}`});
      }
      if(url.pathname==='/api/options'){
        const{ticket}=await body(request,ticketSchema),flow=await store.flow(ticket);
        if(!flow||flow.status!=='pending'||flow.expires_at<=timestamp)throw Error('FLOW_ENDED');
        let options;
        if(flow.operation==='register'){
          const user=await identity.account(flow.uid);if(user.validSince!==flow.valid_since)throw Error('REVOKED');
          const account=await store.account(flow.uid,timestamp,user.validSince),existing=await store.list(flow.uid);
          options=await generateRegistrationOptions({rpName:'C.C. Lime',rpID:config.rpID,userName:'C.C. Lime account',userID:decode(account.user_handle),challenge:decode(flow.challenge),attestationType:'none',timeout:120000,authenticatorSelection:{residentKey:'required',userVerification:'required'},supportedAlgorithmIDs:[-7,-257],excludeCredentials:existing.map(c=>({id:c.id}))});
        }else options=await generateAuthenticationOptions({rpID:config.rpID,challenge:decode(flow.challenge),userVerification:'required',timeout:120000});
        return json({operation:flow.operation,options});
      }
      if(url.pathname==='/api/finish'){
        const input=await body(request,finishSchema),flow=await store.claim(input.ticket,timestamp);
        if(!flow)throw Error('FLOW_ENDED');const code=randomValue();
        if(input.response.id!==input.response.rawId)throw Error('CREDENTIAL');
        if(flow.operation==='register'){
          const user=await identity.account(flow.uid);if(user.validSince!==flow.valid_since)throw Error('REVOKED');
          const result=await verifyRegistrationResponse({response:input.response,expectedChallenge:flow.challenge,expectedOrigin:config.origin,expectedRPID:config.rpID,requireUserPresence:true,requireUserVerification:true,supportedAlgorithmIDs:[-7,-257]});
          if(!result.verified||!result.registrationInfo.userVerified)throw Error('VERIFICATION');
          const info=result.registrationInfo;
          const account=await store.account(flow.uid,timestamp,user.validSince);await identity.publishGate(flow.uid,account.epoch,account.min_auth_time,user.validSince);
          await store.register(flow,{id:info.credential.id,public_key:encode(info.credential.publicKey),counter:info.credential.counter,device_type:info.credentialDeviceType,backed_up:Number(info.credentialBackedUp)},code,now());
        }else{
          const credential=await store.credential(input.response.id);if(!credential||input.response.response.userHandle!==credential.user_handle)throw Error('CREDENTIAL');
          const result=await verifyAuthenticationResponse({response:input.response,expectedChallenge:flow.challenge,expectedOrigin:config.origin,expectedRPID:config.rpID,requireUserVerification:true,credential:{id:credential.id,publicKey:decode(credential.public_key),counter:credential.counter}});
          if(!result.verified||result.authenticationInfo.credentialDeviceType!==credential.device_type)throw Error('VERIFICATION');
          const account=await identity.account(credential.uid);
          const stored=await store.account(credential.uid,timestamp,account.validSince);await identity.publishGate(credential.uid,stored.epoch,stored.min_auth_time,account.validSince);
          await store.db.prepare('UPDATE flows SET valid_since=? WHERE ticket=? AND status=\'verifying\'').bind(account.validSince,flow.ticket).run();
          await store.authenticate(flow,credential,result.authenticationInfo,code,now());
        }
        return json({redirect:callback(flow.redirect,flow.state,code)});
      }
      const input=await body(request,exchangeSchema),flow=await store.consume(input.ticket,input.code,await hash(input.proof),timestamp);
      if(!flow)throw Error('FLOW_ENDED');const credential=await store.credential(flow.credential_id);
      if(!credential||credential.uid!==flow.uid)throw Error('CREDENTIAL');
      const account=await identity.account(flow.uid);if(account.validSince!==flow.valid_since)throw Error('REVOKED');
      if(flow.operation==='register')return json({operation:'registered'});
      const stored=await store.account(flow.uid,timestamp,account.validSince);
      return json({operation:'authenticated',uid:flow.uid,customToken:await identity.issue(flow.uid,flow.valid_since,credential,stored.epoch)});
    }catch(error){
      // Dependency injection is used only by isolated tests, never by the Worker entry point.
      dependencies.onFailure?.(error);
      // No request body, UID, credential, secret, assertion or provider error is logged/reflected.
      if(error?.message==='LIMIT')return json({error:'Too many attempts. Please wait and start again.'},429);
      if(['PROVIDER_UNAVAILABLE','TRUST_UNAVAILABLE'].includes(error?.message))return json({error:'Verification is temporarily unavailable. Try again later.'},503);
      if(error?.message==='CONFIGURATION'||error?.message==='TRUST_NOT_CONFIGURED')return json({error:'Passkey sign-in is awaiting server configuration.'},503);
      if(url.pathname==='/api/session'&&['REVOKED','IDENTITY','RECENT_IDENTITY','NATIVE_FACTOR_REQUIRED','FULL_FACTOR_REQUIRED'].includes(error?.message))return json({error:'Sign in again to verify account security.'},401);
      return json({error:'This passkey attempt could not be completed. Return to C.C. Lime and start again.'},400);
    }
  };
}
export default { fetch:(request,env)=>createHandler(env)(request), async scheduled(_event,env){const store=new D1Store(env.DB),now=Date.now();await store.cleanup(now);const result=await reconcileDeletedAccounts(store,new FirebaseIdentity(env),now);if(result.pending)throw Error('Account cleanup requires retry; no user data logged.');} };
