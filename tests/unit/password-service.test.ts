import { afterEach, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ApplicationService, type HostServices } from '../../src/main/service';
import { item } from '../fixtures';

const fixtures:Array<{root:string;service:ApplicationService}>=[];
afterEach(async()=>{for(const f of fixtures.splice(0)){await f.service.close();if(path.dirname(f.root)!==os.tmpdir()||!path.basename(f.root).startsWith('cc-lime-password-service-'))throw Error('Unsafe cleanup');fs.rmSync(f.root,{recursive:true,force:true});}vi.unstubAllGlobals();});
async function fixture(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'cc-lime-password-service-'));
 // Serialization fixture, not a Windows encryption test.
 const host:HostServices={secure:{isEncryptionAvailable:()=>true,encryptString:value=>Buffer.from(value),decryptString:value=>value.toString()},openBrowser:async()=>{},changed:vi.fn(),notify:vi.fn(),openFile:async()=>null,saveFile:async()=>null,setStartup:()=>{},startupStatus:()=>({enabled:false,wasOpenedAtLogin:false}),dataFolder:()=>{},version:'test'};
 const service=new ApplicationService(root,{projectId:'demo-session-service',apiKey:'synthetic-service-key'},host);fixtures.push({root,service});
 let refreshError:string|null=null,offline=false;
 const requests=vi.fn(async(address:string)=>{
  if(address.includes('securetoken')){if(offline)throw Error('Network unavailable');return refreshError?new Response(JSON.stringify({error:{message:refreshError}}),{status:400}):new Response(JSON.stringify({user_id:'alice',id_token:'synthetic-id',refresh_token:'synthetic-refresh',expires_in:'3600'}));}
  if(address.includes('firestore'))return new Response('{}',{status:404});
  return new Response(JSON.stringify(address.includes(':lookup')?{users:[{localId:'alice',email:'alice@example.test',emailVerified:true,providerUserInfo:[{providerId:'password'}]}]}:{localId:'alice',idToken:'synthetic-id',refreshToken:'synthetic-refresh',expiresIn:'3600'}));
 });vi.stubGlobal('fetch',requests);await service.command('auth.signIn',{email:'alice@example.test',password:'old-password'});
 return{root,service,requests,setRefreshError:(code:string)=>{refreshError=code;},setOffline:()=>{offline=true;}};
}
it('password change hides account data, stops services, clears login and reloads preserved pending edits after sign-in',async()=>{
 const f=await fixture();await f.service.sync!.stop();const pending=item();await f.service.command('save',pending);
 const scheduler=f.service.scheduler!,stop=vi.spyOn(scheduler,'stop');await f.service.command('auth.changePassword',{currentPassword:'old-password',password:'V9!r2Kq8',confirmation:'V9!r2Kq8'});
 expect(f.service.snapshot()).toMatchObject({session:null,records:[],remembered:false,signInNotice:'Password changed. Sign in with your new password.'});expect(stop).toHaveBeenCalled();expect(fs.existsSync(path.join(f.root,'session.enc'))).toBe(false);await vi.waitFor(()=>expect(f.service.store).toBeNull());
 await f.service.command('auth.signIn',{email:'alice@example.test',password:'V9!r2Kq8'});await f.service.sync!.stop();expect(f.service.snapshot().signInNotice).toBeNull();expect(f.service.store!.get(pending.id)).toEqual(pending);expect(f.service.store!.queueCount()).toBe(1);
});
it('revocation found during sync hides the account and closes its store after the in-flight request unwinds',async()=>{
 const f=await fixture(),scheduler=f.service.scheduler!,stop=vi.spyOn(scheduler,'stop');f.setRefreshError('TOKEN_EXPIRED');f.requests.mockClear();await f.service.sync!.sync();
 expect(f.service.snapshot()).toMatchObject({session:null,records:[],remembered:false});expect(f.service.snapshot().signInNotice).toContain('Sign in again');expect(stop).toHaveBeenCalled();expect(f.requests.mock.calls.some(([address])=>address.includes('firestore'))).toBe(false);await vi.waitFor(()=>expect(f.service.store).toBeNull());
});
it('an offline session check preserves login and saved changes rather than treating a network error as revocation',async()=>{
 const f=await fixture();f.setOffline();await f.service.sync!.sync();expect(f.service.snapshot().session?.uid).toBe('alice');expect(f.service.snapshot().remembered).toBe(true);expect(f.service.snapshot().sync.state).toBe('offline');expect(f.service.snapshot().signInNotice).toBeNull();
});
