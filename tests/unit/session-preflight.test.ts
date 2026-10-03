import { afterEach, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { LocalStore } from '../../src/main/store';
import { SyncEngine } from '../../src/main/sync';
import type { CloudAdapter } from '../../src/main/cloud';
import type { Session } from '../../src/shared/model';
import { item } from '../fixtures';

const fixtures:Array<{root:string;store:LocalStore;sync:SyncEngine}>=[];
function fixture(verified=true){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'cc-lime-session-preflight-')),store=new LocalStore(root,'alice');
 let session:Session|null={uid:'alice',email:'alice@example.test',displayName:'Alice',verified,providers:['password']};
 const cloud:CloudAdapter={get:vi.fn(async()=>null),head:vi.fn(async()=>0),changes:vi.fn(async()=>[]),commit:vi.fn(),deletionStarted:vi.fn(async()=>false)};
 const validate=vi.fn(async()=>{}),sync=new SyncEngine(store,cloud,()=>session,undefined,undefined,validate);fixtures.push({root,store,sync});
 return{store,sync,cloud,validate,setSession:(next:Session|null)=>{session=next;},getSession:()=>session};
}
afterEach(async()=>{for(const f of fixtures.splice(0)){await f.sync.stop();f.store.close();if(path.dirname(f.root)!==os.tmpdir()||!path.basename(f.root).startsWith('cc-lime-session-preflight-'))throw Error('Unsafe cleanup');fs.rmSync(f.root,{recursive:true,force:true});}});
it('checks revocation before any cloud action and leaves pending data intact',async()=>{
 const f=fixture(),pending=item();f.store.save(pending);f.validate.mockImplementation(async()=>{f.setSession(null);throw Error('Revoked');});await f.sync.sync();
 expect(f.validate).toHaveBeenCalledTimes(1);for(const fn of Object.values(f.cloud))expect(fn).not.toHaveBeenCalled();expect(f.store.get(pending.id)).toEqual(pending);expect(f.store.queueCount()).toBe(1);
});
it('checks sessions awaiting verification and retries network failures without signing out or uploading',async()=>{
 const f=fixture(false);await f.sync.sync();expect(f.validate).toHaveBeenCalledTimes(1);expect(f.sync.status.state).toBe('verification');expect(f.cloud.head).not.toHaveBeenCalled();
 f.validate.mockRejectedValueOnce(Error('Network unavailable'));await f.sync.sync();expect(f.getSession()?.uid).toBe('alice');expect(f.sync.status.state).toBe('offline');expect(f.cloud.head).not.toHaveBeenCalled();
});
it('an account change during preflight cannot sync the earlier account',async()=>{
 const f=fixture();f.validate.mockImplementation(async()=>f.setSession({...f.getSession()!,uid:'bob'}));await f.sync.sync();for(const fn of Object.values(f.cloud))expect(fn).not.toHaveBeenCalled();
});
