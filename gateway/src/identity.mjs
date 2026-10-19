import { createRemoteJWKSet, jwtVerify, importPKCS8, SignJWT } from 'jose';
const jwks = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
const uidPattern = /^[A-Za-z0-9_-]{1,128}$/;
/** Server only. All credentials are Worker secret bindings, never browser/desktop assets. */
export class FirebaseIdentity {
  constructor(env) { this.env=env; }
  async signingKey() {
    if(!this.env.FIREBASE_SIGNER_EMAIL?.endsWith(`@${this.env.FIREBASE_PROJECT_ID}.iam.gserviceaccount.com`) || !this.env.FIREBASE_SIGNER_PRIVATE_KEY)throw Error('TRUST_NOT_CONFIGURED');
    return importPKCS8(this.env.FIREBASE_SIGNER_PRIVATE_KEY,'RS256');
  }
  async accessToken() {
    const now=Math.floor(Date.now()/1000);
    const assertion=await new SignJWT({scope:'https://www.googleapis.com/auth/identitytoolkit https://www.googleapis.com/auth/datastore'}).setProtectedHeader({alg:'RS256'}).setIssuer(this.env.FIREBASE_SIGNER_EMAIL).setAudience('https://oauth2.googleapis.com/token').setIssuedAt(now).setExpirationTime(now+300).sign(await this.signingKey());
    const result=await boundedFetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion})});
    if(typeof result.access_token!=='string')throw Error('TRUST_UNAVAILABLE');return result.access_token;
  }
  async account(uid) {
    if(!uidPattern.test(uid))throw Error('IDENTITY');
    let pilot;try{pilot=JSON.parse(this.env.PILOT_UIDS);}catch{throw Error('TRUST_NOT_CONFIGURED');}
    if(!Array.isArray(pilot)||pilot.length<1||pilot.length>20||!pilot.every(v=>typeof v==='string'&&uidPattern.test(v))||!pilot.includes(uid))throw Error('IDENTITY');
    const user=await this.lookup(uid);
    if(user?.localId!==uid||user.disabled===true||user.emailVerified!==true)throw Error('IDENTITY');
    const validSince=Number(user.validSince??0);if(!Number.isSafeInteger(validSince)||validSince<0)throw Error('IDENTITY');
    const hasTotp=(user.mfaInfo??[]).some(f=>f.totpInfo),hasPassword=(user.providerUserInfo??[]).some(p=>p.providerId==='password');
    if(hasPassword&&!hasTotp)throw Error('NATIVE_FACTOR_REQUIRED');
    return{uid,validSince,hasTotp,hasPassword};
  }
  async lookup(uid) {
    if(!uidPattern.test(uid))throw Error('IDENTITY');
    const result=await boundedFetch(`https://identitytoolkit.googleapis.com/v1/projects/${this.env.FIREBASE_PROJECT_ID}/accounts:lookup`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${await this.accessToken()}`},body:JSON.stringify({localId:[uid]})});
    // Only an authenticated, successful empty lookup proves deletion. Outage/errors never purge data.
    if(!result||typeof result!=='object'||Array.isArray(result)||result.error||(result.users!==undefined&&!Array.isArray(result.users)))throw Error('PROVIDER_UNAVAILABLE');
    const users=result.users??[];if(users.length===0)return null;
    if(users.length!==1||users[0]?.localId!==uid)throw Error('PROVIDER_UNAVAILABLE');return users[0];
  }
  async eraseGate(uid) {
    const existing=await this.gate(uid);if(!existing)return;
    if(typeof existing.updateTime!=='string')throw Error('PROVIDER_UNAVAILABLE');
    await boundedFetch(this.gateUrl(uid)+'?'+new URLSearchParams({'currentDocument.updateTime':existing.updateTime}),{method:'DELETE',headers:{Authorization:`Bearer ${await this.accessToken()}`}});
  }
  async verify(idToken,recent=true) {
    const {payload}=await jwtVerify(idToken,jwks,{issuer:`https://securetoken.google.com/${this.env.FIREBASE_PROJECT_ID}`,audience:this.env.FIREBASE_PROJECT_ID,algorithms:['RS256']});
    const uid=payload.sub,now=Math.floor(Date.now()/1000),authTime=payload.auth_time;
    if(!uid||!uidPattern.test(uid)||payload.email_verified!==true||!Number.isSafeInteger(authTime)||authTime>now+10||(recent&&now-authTime>300))throw Error('RECENT_IDENTITY');
    const user=await this.account(uid);if(authTime<user.validSince)throw Error('REVOKED');
    const identity=payload.firebase??{};
    const fullTotp=identity.sign_in_second_factor==='totp'&&['password','google.com'].includes(identity.sign_in_provider);
    const passkey=identity.sign_in_provider==='custom'&&payload.cc_lime_passkey?.v===1&&Number.isSafeInteger(payload.cc_lime_passkey?.until)&&payload.cc_lime_passkey.until>=now&&payload.cc_lime_passkey.until<=authTime+3600;
    if(passkey){if(payload.cc_lime_passkey.valid_since!==user.validSince)throw Error('REVOKED');await this.checkGate(uid,payload.cc_lime_passkey.epoch,user.validSince,authTime);}
    const google=identity.sign_in_provider==='google.com'&&!user.hasTotp;
    return{...user,authTime,fullFactor:fullTotp||passkey,google,...(passkey?{passkeyEpoch:payload.cc_lime_passkey.epoch}:{})};
  }
  gateUrl(uid){if(!uidPattern.test(uid))throw Error('IDENTITY');return `https://firestore.googleapis.com/v1/projects/${this.env.FIREBASE_PROJECT_ID}/databases/(default)/documents/authSecurity/${uid}`;}
  async gate(uid){return boundedFetch(this.gateUrl(uid),{headers:{Authorization:`Bearer ${await this.accessToken()}`}},true);}
  async publishGate(uid, epoch, minAuthTime, validSince) {
    const existing=await this.gate(uid),fields=existing?.fields??{};
    const oldEpoch=Number(fields.epoch?.integerValue??0),oldMinimum=Number(fields.min_auth_time?.integerValue??0),oldValid=Number(fields.valid_since?.integerValue??0);
    if(![epoch,minAuthTime,validSince,oldEpoch,oldMinimum,oldValid].every(n=>Number.isSafeInteger(n)&&n>=0)||oldEpoch>epoch||oldValid>validSince)throw Error('STALE_GATE');
    const query=new URLSearchParams(existing?{'currentDocument.updateTime':existing.updateTime}:{'currentDocument.exists':'false'});
    await boundedFetch(this.gateUrl(uid)+'?'+query,{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:`Bearer ${await this.accessToken()}`},body:JSON.stringify({fields:{epoch:{integerValue:String(epoch)},min_auth_time:{integerValue:String(Math.max(minAuthTime,oldMinimum,validSince))},valid_since:{integerValue:String(validSince)}}})});
  }
  async checkGate(uid,epoch,validSince,authTime) {
    const gate=await this.gate(uid),fields=gate?.fields;
    const values=[epoch,validSince,authTime,Number(fields?.epoch?.integerValue),Number(fields?.valid_since?.integerValue),Number(fields?.min_auth_time?.integerValue)];
    if(!fields||!values.every(n=>Number.isSafeInteger(n)&&n>=0)||values[3]!==epoch||values[4]!==validSince||authTime<values[5])throw Error('REVOKED');
  }
  async issue(uid, validSince, credential, epoch) {
    const user=await this.account(uid);if(user.validSince!==validSince||credential.revoked_at!==null)throw Error('REVOKED');
    const now=Math.floor(Date.now()/1000);
    await this.checkGate(uid,epoch,validSince,now);
    // This is an assurance-expiring session, not a fake native TOTP claim.
    return new SignJWT({uid,claims:{cc_lime_passkey:{v:1,until:now+3600,valid_since:validSince,epoch}}})
      .setProtectedHeader({alg:'RS256'}).setIssuer(this.env.FIREBASE_SIGNER_EMAIL).setSubject(this.env.FIREBASE_SIGNER_EMAIL)
      .setAudience('https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit').setIssuedAt(now).setExpirationTime(now+120).sign(await this.signingKey());
  }
}
export async function boundedFetch(url,options,allowNotFound=false) {
  const response=await fetch(url,{...options,signal:AbortSignal.timeout(15000),redirect:'error'});
  if(allowNotFound&&response.status===404){await response.body?.cancel();return null;}
  if(!response.ok){await response.body?.cancel();throw Error('PROVIDER_UNAVAILABLE');}
  if(response.status===204&&options.method==='DELETE')return {};
  const reader=response.body?.getReader();if(!reader)throw Error('PROVIDER_UNAVAILABLE');let size=0,text='';const decoder=new TextDecoder('utf-8',{fatal:true});
  try{while(true){const{done,value}=await reader.read();if(done)break;size+=value.length;if(size>131072){await reader.cancel();throw Error('PROVIDER_UNAVAILABLE');}text+=decoder.decode(value,{stream:true});}text+=decoder.decode();return JSON.parse(text);}finally{reader.releaseLock();}
}
