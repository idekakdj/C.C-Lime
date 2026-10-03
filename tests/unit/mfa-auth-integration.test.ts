import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { generateKeyPair, SignJWT, exportJWK, createLocalJWKSet } from 'jose';
import { AuthService } from '../../src/main/auth';
import { ApplicationService, type HostServices } from '../../src/main/service';
const keyStore = vi.hoisted(() => ({ jwks: null as any }));
vi.mock('jose', async original => ({ ...await original<typeof import('jose')>(), createRemoteJWKSet: (url: URL) => {
  if (url.hostname !== 'www.googleapis.com' || !url.pathname.includes('securetoken')) throw Error('Unexpected trust endpoint');
  return keyStore.jwks;
} }));
let key: Awaited<ReturnType<typeof generateKeyPair>>['privateKey'];
const roots: string[] = [], services: AuthService[] = [];
beforeAll(async()=>{const pair=await generateKeyPair('RS256');key=pair.privateKey;keyStore.jwks=createLocalJWKSet({keys:[{...await exportJWK(pair.publicKey),kid:'test-key',alg:'RS256'}]});});
afterEach(()=>{for(const auth of services.splice(0))auth.cancelAuthentication();vi.unstubAllGlobals();for(const root of roots.splice(0)){if(path.dirname(root)!==os.tmpdir()||!path.basename(root).startsWith('cc-lime-mfa-auth-'))throw Error('Unsafe test path');fs.rmSync(root,{recursive:true,force:true});}});
async function fixture(claim='totp') {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'cc-lime-mfa-auth-'));roots.push(root);
  const auth=new AuthService({projectId:'demo-cc-lime',apiKey:'synthetic-mfa-key',totpEnabled:true},root,{isEncryptionAvailable:()=>true,encryptString:v=>Buffer.from(v),decryptString:v=>v.toString()},async()=>{});services.push(auth);
  const idToken=await new SignJWT({firebase:{sign_in_provider:'password',sign_in_second_factor:claim},email_verified:true}).setProtectedHeader({alg:'RS256',kid:'test-key'}).setSubject('alice').setIssuer('https://securetoken.google.com/demo-cc-lime').setAudience('demo-cc-lime').setIssuedAt().setExpirationTime('1h').sign(key);
  const requests=vi.fn(async(address:string,options:any)=>{
    if(address.includes(':signInWithPassword')) return new Response(JSON.stringify(claim === 'none' ? { localId:'alice',idToken,refreshToken:'synthetic-first-factor-refresh' } : {mfaPendingCredential:'synthetic-pending-secret',mfaInfo:[{mfaEnrollmentId:'synthetic-factor-id',totpInfo:{}}]}));
    if(address.includes('/mfaSignIn:finalize')) return new Response(JSON.stringify({idToken,refreshToken:'synthetic-final-refresh'}));
    if(address.includes(':lookup')) return new Response(JSON.stringify({users:[{localId:'alice',email:'alice@example.test',emailVerified:true,providerUserInfo:[{providerId:'password'}],mfaInfo:[{totpInfo:{},displayName:'Phone authenticator'}]}]}));
    if(address.includes(':update')) return new Response(JSON.stringify({localId:'alice'}));
    throw Error('Unexpected fixture endpoint');
  });vi.stubGlobal('fetch',requests);return{auth,root,requests};
}
it('does not create a session/file until the signed native TOTP result is verified',async()=>{
  const f=await fixture();const signing=f.auth.signIn('alice@example.test','existing-password');await vi.waitFor(()=>expect(f.auth.mfaChallenge).not.toBeNull());
  const view=f.auth.mfaChallenge!;expect(f.auth.session).toBeNull();expect(fs.existsSync(path.join(f.root,'session.enc'))).toBe(false);
  expect(JSON.stringify(view)).not.toMatch(/synthetic-pending|synthetic-factor/);
  await f.auth.verifyMfa(view.handle,view.factors[0].handle,'001234');await expect(signing).resolves.toHaveProperty('uid','alice');
  expect(f.auth.mfaChallenge).toBeNull();expect(f.auth.security.factors[0].label).toBe('Phone authenticator');
});
it('refuses a signed result that does not have native TOTP assurance',async()=>{
  const f=await fixture('phone');const signing=f.auth.signIn('alice@example.test','existing-password');const rejected=expect(signing).rejects.toThrow('canceled or expired');
  await vi.waitFor(()=>expect(f.auth.mfaChallenge).not.toBeNull());const v=f.auth.mfaChallenge!;
  await expect(f.auth.verifyMfa(v.handle,v.factors[0].handle,'123456')).rejects.toThrow('could not be verified');await rejected;expect(f.auth.session).toBeNull();
});
it('cancellation rejects the suspended operation and cannot be resumed by an old challenge',async()=>{
  const f=await fixture();const signing=f.auth.signIn('alice@example.test','existing-password');const rejected=expect(signing).rejects.toThrow('canceled');
  await vi.waitFor(()=>expect(f.auth.mfaChallenge).not.toBeNull());const v=f.auth.mfaChallenge!;f.auth.cancelAuthentication();await rejected;
  await expect(f.auth.verifyMfa(v.handle,v.factors[0].handle,'123456')).rejects.toThrow('ended');expect(f.auth.session).toBeNull();
});
it('suspends password mutation until a fresh TOTP proof, then forces new sign-in',async()=>{
  const f=await fixture();const first=f.auth.signIn('alice@example.test','old-password');await vi.waitFor(()=>expect(f.auth.mfaChallenge).not.toBeNull());let v=f.auth.mfaChallenge!;
  await f.auth.verifyMfa(v.handle,v.factors[0].handle,'123456');await first;f.requests.mockClear();
  const change=f.auth.changePassword('old-password','Unique new password 42');await vi.waitFor(()=>expect(f.auth.mfaChallenge).not.toBeNull());
  expect(f.requests.mock.calls.some(([url])=>url.includes(':update'))).toBe(false);v=f.auth.mfaChallenge!;
  await f.auth.verifyMfa(v.handle,v.factors[0].handle,'234567');await change;
  expect(f.auth.session).toBeNull();expect(f.auth.signInNotice).toContain('Password changed');expect(f.requests.mock.calls.some(([url])=>url.includes(':update'))).toBe(true);
});
it('required mode holds a password-only identity in enrollment without saved login or cloud token access',async()=>{
  const f=await fixture('none');f.auth.config!.mfaRequired=true;
  const session=await f.auth.signIn('alice@example.test','existing-password');expect(session.enrollmentRequired).toBe(true);
  expect(f.auth.remembered).toBe(false);expect(fs.existsSync(path.join(f.root,'session.enc'))).toBe(false);
  await expect(f.auth.token()).rejects.toMatchObject({code:'MFA_REQUIRED'});
});
it('enrollment-only acceptance clears an older saved full-factor login',async()=>{
  const f=await fixture('none');fs.writeFileSync(path.join(f.root,'session.enc'),'synthetic-old-full-session');f.auth.config!.mfaRequired=true;
  await f.auth.signIn('alice@example.test','existing-password');expect(fs.existsSync(path.join(f.root,'session.enc'))).toBe(false);
  expect(fs.existsSync(path.join(f.root,'session.enc.signed-out'))).toBe(true);
});
it('does not restore passkey assurance without its fixed expiry or trusted gateway configuration',async()=>{
  for(const savedSession of [
    {assurance:'passkey'},
    {assurance:'passkey',passkeyUntil:Math.floor(Date.now()/1000)+3000},
  ]){
    const f=await fixture('none');fs.writeFileSync(path.join(f.root,'session.enc'),JSON.stringify({projectId:'demo-cc-lime',refreshToken:'synthetic-refresh',session:{uid:'alice',email:'alice@example.test',displayName:'Test',verified:true,providers:['password'],...savedSession}}));
    f.auth.restore();expect(f.auth.session).toBeNull();expect(f.auth.remembered).toBe(false);
  }
});
it('required mode accepts and persists only a signed native full-factor session',async()=>{
  const f=await fixture();f.auth.config!.mfaRequired=true;const signing=f.auth.signIn('alice@example.test','existing-password');
  await vi.waitFor(()=>expect(f.auth.mfaChallenge).not.toBeNull());const v=f.auth.mfaChallenge!;await f.auth.verifyMfa(v.handle,v.factors[0].handle,'123456');
  expect((await signing).assurance).toBe('totp');expect(f.auth.session?.enrollmentRequired).toBeUndefined();expect(f.auth.remembered).toBe(true);
});
it('the application creates no calendar, reminders or sync engine for enrollment-only sign-in',async()=>{
  const f=await fixture('none');f.auth.config!.mfaRequired=true;
  const host:HostServices={secure:{isEncryptionAvailable:()=>true,encryptString:v=>Buffer.from(v),decryptString:v=>v.toString()},openBrowser:async()=>{},changed:()=>{},notify:vi.fn(),openFile:async()=>null,saveFile:async()=>null,setStartup:()=>{},startupStatus:()=>({enabled:false,wasOpenedAtLogin:false}),dataFolder:()=>{},version:'test'};
  const root=path.join(f.root,'application'),service=new ApplicationService(root,f.auth.config,host);
  try{
    await service.command('auth.signIn',{email:'alice@example.test',password:'existing-password'});
    expect(service.auth.session?.enrollmentRequired).toBe(true);expect(service.store).toBeNull();expect(service.scheduler).toBeNull();expect(service.sync).toBeNull();
    expect(fs.existsSync(path.join(root,'accounts'))).toBe(false);expect(service.snapshot().records).toEqual([]);
    await expect(service.command('profile.save',{name:'Unenrolled identity'})).rejects.toThrow('Open a calendar');expect(host.notify).not.toHaveBeenCalled();
  }finally{await service.close();}
});
it.each([401,503])('passkey refresh status %i distinguishes revocation from an outage without using an unverified token',async status=>{
  const f=await fixture('none'),now=Math.floor(Date.now()/1000);f.auth.config!.passkeyOrigin='https://calendar-auth.example.test';f.auth.config!.mfaRequired=true;
  fs.writeFileSync(path.join(f.root,'session.enc'),JSON.stringify({projectId:'demo-cc-lime',refreshToken:'synthetic-old-refresh',session:{uid:'alice',email:'alice@example.test',displayName:'Test',verified:true,providers:['password'],assurance:'passkey',passkeyUntil:now+3000}}));f.auth.restore();
  const idToken=await new SignJWT({auth_time:now,email_verified:true,firebase:{sign_in_provider:'custom'},cc_lime_passkey:{v:1,epoch:2,valid_since:0,until:now+3000}}).setProtectedHeader({alg:'RS256',kid:'test-key'}).setSubject('alice').setIssuer('https://securetoken.google.com/demo-cc-lime').setAudience('demo-cc-lime').setIssuedAt().setExpirationTime('1h').sign(key);
  f.requests.mockImplementation(async address=>{
    if(address.includes('/v1/token?'))return new Response(JSON.stringify({user_id:'alice',id_token:idToken,refresh_token:'synthetic-new-refresh',expires_in:'3600'}));
    if(address==='https://calendar-auth.example.test/api/session')return new Response(JSON.stringify({error:'Private provider details must not be reflected'}),{status});
    throw Error('Unexpected fixture endpoint');
  });
  await expect(f.auth.token(true)).rejects.toThrow('Passkey verification could not be completed');
  if(status===401){expect(f.auth.session).toBeNull();expect(fs.existsSync(path.join(f.root,'session.enc'))).toBe(false);}
  else{expect(f.auth.session?.offline).toBe(true);expect(fs.existsSync(path.join(f.root,'session.enc'))).toBe(true);}
});
