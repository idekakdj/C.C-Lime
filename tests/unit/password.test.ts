import { afterEach, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AuthService } from '../../src/main/auth';
import { passwordFeedback, validateNewPassword } from '../../src/shared/password';
const roots:string[]=[];
function auth(providers=['password']){const folder=fs.mkdtempSync(path.join(os.tmpdir(),'cc-lime-password-'));roots.push(folder);const a=new AuthService({projectId:'demo-password',apiKey:'demo-key'},folder,{isEncryptionAvailable:()=>false,encryptString:()=>Buffer.alloc(0),decryptString:()=>''},async()=>{});a.session={uid:'alice',email:'alice@example.test',displayName:'Alice',verified:true,providers};return a;}
afterEach(()=>{vi.unstubAllGlobals();for(const folder of roots.splice(0)){if(path.dirname(folder)!==os.tmpdir()||!path.basename(folder).startsWith('cc-lime-password-'))throw new Error('Unsafe cleanup');fs.rmSync(folder,{recursive:true,force:true});}});
const newPassword='V9!r2Kq8';
it.each([7,8,14,15,128,129])('applies the new-password boundary at %i code points',length=>{
 const value='R'+'m'.repeat(length-2)+'7';expect(passwordFeedback(value).valid).toBe(length>=8&&length<=128);
 if(length>=8&&length<=128)expect(()=>validateNewPassword(value,value)).not.toThrow();else expect(()=>validateNewPassword(value,value)).toThrow('8–128');
});
it('counts Unicode code points and distinguishes accepted short passwords from longer passphrases',()=>{
 const unicode='🌿ab cdé9';expect([...unicode]).toHaveLength(8);expect(()=>validateNewPassword(unicode,unicode)).not.toThrow();expect(()=>validateNewPassword(unicode.slice(0,-1),unicode.slice(0,-1))).toThrow('8–128');
 expect(passwordFeedback(newPassword)).toMatchObject({valid:true,label:'Fair'});expect(passwordFeedback('a quiet amber river')).toMatchObject({valid:true,label:'Good'});expect(passwordFeedback('Synthetic violet river 47')).toMatchObject({valid:true,label:'Stronger'});
});
it.each(['password','PASSWORD',' password ','password1','12345678','qwerty123','welcome1','cclime123','abababab'])('rejects a length-eligible predictable password %j',value=>{
 expect(passwordFeedback(value).valid).toBe(false);expect(()=>validateNewPassword(value,value)).toThrow('avoid common');
});
it.each(['signUp','linkPassword','changePassword'] as const)('rejects a seven-character new password before %s sends any provider request',async operation=>{
 const a=auth(operation==='linkPassword'?['google.com']:['password']),request=vi.fn();vi.stubGlobal('fetch',request);
 const outcome=operation==='signUp'?a.signUp('alice@example.test','V9!r2Kq',''):operation==='linkPassword'?a.linkPassword('V9!r2Kq'):a.changePassword('legacy7','V9!r2Kq');
 await expect(outcome).rejects.toThrow('8–128');expect(request).not.toHaveBeenCalled();expect(a.session?.uid).toBe('alice');
});
it.each(['signUp','linkPassword'] as const)('accepts an eight-character new password for %s',async operation=>{
 const a=auth(operation==='linkPassword'?['google.com']:['password']);if(operation==='linkPassword')vi.spyOn(a,'token').mockResolvedValue('existing-id');
 const request=vi.fn(async(url:string)=>new Response(JSON.stringify(url.includes(':lookup')?{users:[{localId:'alice',email:'alice@example.test',emailVerified:true,providerUserInfo:[{providerId:'password'}]}]}:{localId:'alice',idToken:'synthetic-id',refreshToken:'synthetic-refresh',expiresIn:'3600'})));vi.stubGlobal('fetch',request);
 await (operation==='signUp'?a.signUp('alice@example.test',newPassword,''):a.linkPassword(newPassword));expect(request).toHaveBeenCalledTimes(2);expect(JSON.parse((request.mock.calls[0] as unknown as [string,{body:string}])[1].body).password).toBe(newPassword);
});
it.each(['WEAK_PASSWORD : Password should be at least 8 characters','PASSWORD_DOES_NOT_MEET_REQUIREMENTS'])('reports the eight-character policy for provider rejection %j',async message=>{
 const a=auth();vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({error:{message}}),{status:400})));await expect(a.signUp('alice@example.test',newPassword,'')).rejects.toThrow('8–128');
});
it('supports long passphrases and Unicode, rejects weak/overlong new passwords and mismatched confirmation',()=>{
 for(const value of ['short','passwordpassword','a'.repeat(20),'abc'.repeat(6),'🙂'.repeat(129)])expect(passwordFeedback(value).valid).toBe(false);
 for(const value of [newPassword,'a quiet amber river','🙂éx planet meadow 47']){expect(passwordFeedback(value).valid).toBe(true);expect(()=>validateNewPassword(value,value)).not.toThrow();}
 expect(()=>validateNewPassword(newPassword,newPassword+'x')).toThrow('must match');
});
it('wrong current password never reaches password update',async()=>{
 const a=auth(),request=vi.fn(async()=>new Response(JSON.stringify({error:{message:'INVALID_LOGIN_CREDENTIALS'}}),{status:400}));vi.stubGlobal('fetch',request);
 await expect(a.changePassword('wrong',newPassword)).rejects.toThrow('incorrect');expect(request).toHaveBeenCalledTimes(1);expect(a.session?.uid).toBe('alice');
});
it('fresh verification token changes the same account and discards replacement credentials until explicit sign-in',async()=>{
 const a=auth(),bodies:any[]=[],actions:string[]=[];
 vi.stubGlobal('fetch',vi.fn(async(url:string,options:any)=>{actions.push(new URL(url).pathname);const body=JSON.parse(options.body);bodies.push(body);return new Response(JSON.stringify(actions.length===1?{localId:'alice',idToken:'fresh-current',refreshToken:'old'}:actions.length===2?{localId:'alice',idToken:'rotated',refreshToken:'new',expiresIn:'3600'}:{users:[{localId:'alice',email:'alice@example.test',emailVerified:true,providerUserInfo:[{providerId:'password'}]}]}));}));
 await a.changePassword('old-password',newPassword);expect(bodies[1]).toEqual({idToken:'fresh-current',password:newPassword,returnSecureToken:true});expect(a.session).toBeNull();expect(a.remembered).toBe(false);expect(a.signInNotice).toBe('Password changed. Sign in with your new password.');await expect(a.token()).rejects.toMatchObject({code:'SIGNED_OUT'});expect(actions.map(x=>x.split(':')[1])).toEqual(['signInWithPassword','update']);
});
it('a rejected password update preserves the current session and does not announce success',async()=>{
 const a=auth();let calls=0;vi.stubGlobal('fetch',vi.fn(async()=>++calls===1?new Response(JSON.stringify({localId:'alice',idToken:'fresh'})):new Response(JSON.stringify({error:{message:'TOO_MANY_ATTEMPTS_TRY_LATER'}}),{status:429})));
 await expect(a.changePassword('old-password',newPassword)).rejects.toThrow('Please wait');expect(a.session?.uid).toBe('alice');expect(a.signInNotice).toBeNull();
});
it('Google-only accounts and weak new passwords are rejected before network effects',async()=>{
 const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);await expect(auth(['google.com']).changePassword('old',newPassword)).rejects.toThrow('does not have');await expect(auth().changePassword('old','short')).rejects.toThrow();expect(fetcher).not.toHaveBeenCalled();
});
it('sign-out during current-password verification prevents update',async()=>{
 const a=auth();let finish!:(value:Response)=>void;const fetcher=vi.fn(()=>new Promise<Response>(resolve=>{finish=resolve;}));vi.stubGlobal('fetch',fetcher);const operation=a.changePassword('old',newPassword);a.signOut();finish(new Response(JSON.stringify({localId:'alice',idToken:'fresh'})));await expect(operation).rejects.toThrow('Account changed');expect(fetcher).toHaveBeenCalledTimes(1);expect(a.session).toBeNull();
});
it('a mismatched provider identity cannot update another account',async()=>{
 const fetcher=vi.fn(async()=>new Response(JSON.stringify({localId:'bob',idToken:'bob-token'})));vi.stubGlobal('fetch',fetcher);await expect(auth().changePassword('old',newPassword)).rejects.toThrow('does not match');expect(fetcher).toHaveBeenCalledTimes(1);
});
it('sign-out while a provider update is in flight cannot restore the old session',async()=>{
 const a=auth();let finish!:(value:Response)=>void,calls=0;vi.stubGlobal('fetch',vi.fn(async()=>{calls++;if(calls===1)return new Response(JSON.stringify({localId:'alice',idToken:'fresh'}));if(calls===2)return new Promise<Response>(resolve=>{finish=resolve;});return new Response(JSON.stringify({users:[{localId:'alice'}]}));}));
 const operation=a.changePassword('old',newPassword);await vi.waitFor(()=>expect(finish).toBeTypeOf('function'));a.signOut();finish(new Response(JSON.stringify({localId:'alice',idToken:'rotated',refreshToken:'new'})));await expect(operation).rejects.toThrow('Account changed');expect(a.session).toBeNull();
});
