import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'node:crypto';
import { AuthService, type SecureStorage } from '../../src/main/auth';
import { FirestoreCloud } from '../../src/main/cloud';
import { LocalStore } from '../../src/main/store';
import { SyncEngine } from '../../src/main/sync';
import { item } from '../fixtures';

const project='demo-cc-lime', authOrigin='http://127.0.0.1:9099', firestoreOrigin='http://127.0.0.1:8080';
const roots:string[]=[]; const stores:LocalStore[]=[]; const engines:SyncEngine[]=[];
const key=randomBytes(32);
// The adapter test proves encrypted-file behavior; installed Windows tests exercise Electron safeStorage itself.
const secure:SecureStorage={isEncryptionAvailable:()=>true,encryptString:value=>{const iv=randomBytes(12), c=createCipheriv('aes-256-gcm',key,iv);return Buffer.concat([iv,c.update(value,'utf8'),c.final(),c.getAuthTag()]);},decryptString:value=>{const d=createDecipheriv('aes-256-gcm',key,value.subarray(0,12));d.setAuthTag(value.subarray(-16));return Buffer.concat([d.update(value.subarray(12,-16)),d.final()]).toString();}};
function directory(){const p=fs.mkdtempSync(path.join(os.tmpdir(),'cc-lime-cloud-'));roots.push(p);return p;}
function auth(root=directory()){return new AuthService({projectId:project,apiKey:'demo-key'},root,secure,async()=>{},()=>{},authOrigin);}
beforeEach(async()=>{await fetch(`${firestoreOrigin}/emulator/v1/projects/${project}/databases/(default)/documents`,{method:'DELETE'});await fetch(`${authOrigin}/emulator/v1/projects/${project}/accounts`,{method:'DELETE'});});
afterEach(async()=>{await Promise.all(engines.splice(0).map(e=>e.stop()));stores.splice(0).forEach(s=>s.close());for(const root of roots.splice(0))if(root.startsWith(path.join(os.tmpdir(),'cc-lime-cloud-')))fs.rmSync(root,{recursive:true,force:true});});
async function verifiedAccount(){const a=auth();await a.signUp('student@example.test','test-password-123','Student');await a.sendVerification();const codes=await (await fetch(`${authOrigin}/emulator/v1/projects/${project}/oobCodes`)).json();const code=codes.oobCodes.find((c:any)=>c.requestType==='VERIFY_EMAIL');await fetch(`${authOrigin}/identitytoolkit.googleapis.com/v1/accounts:update?key=demo-key`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({oobCode:code.oobCode})});await a.refreshProfile();expect(a.session?.verified).toBe(true);return a;}
function device(a:AuthService){const s=new LocalStore(directory(),a.session!.uid);stores.push(s);const c=new FirestoreCloud(project,a.session!.uid,()=>a.token(),firestoreOrigin);const e=new SyncEngine(s,c,()=>a.session);engines.push(e);return {s,c,e};}
describe('authentication and two-device integration',()=>{
  it('keeps a persisted linked group atomic through a lost response and restart',async()=>{const a=await verifiedAccount(),x=device(a),y=device(a),first=item(),second=item();x.s.saveGroup([{id:first.id,value:first},{id:second.id,value:second}]);const group=x.s.queue();expect(group[0].groupId).toBe(group[1].groupId);const remotes=await x.c.commitGroup(group,group[0].groupId!);expect(remotes[0].sequence).toBe(remotes[1].sequence);await x.e.sync();expect(x.s.queue()).toHaveLength(0);expect(await x.c.head()).toBe(1);await y.e.sync();expect(y.s.list()).toEqual(x.s.list());});
  it('registers, verifies, encrypts a remembered session, restores and serializes refresh',async()=>{
    const root=directory(),a=auth(root);await a.signUp('student@example.test','test-password-123','Student');expect(a.session?.verified).toBe(false);const encrypted=fs.readFileSync(path.join(root,'session.enc')).toString('utf8');expect(encrypted).not.toContain('refreshToken');expect(encrypted).not.toContain('student@example.test');
    const restored=auth(root);restored.restore();expect(restored.session?.uid).toBe(a.session?.uid);expect(restored.session?.offline).toBe(true);
    const tokens=await Promise.all([restored.token(true),restored.token(true),restored.token(true)]);expect(new Set(tokens).size).toBe(1);restored.signOut();expect(fs.existsSync(path.join(root,'session.enc'))).toBe(false);await expect(restored.token()).rejects.toThrow('sign in');
  });
  it('does not persist a plaintext fallback when secure storage is unavailable',async()=>{const root=directory();const a=new AuthService({projectId:project,apiKey:'demo-key'},root,{...secure,isEncryptionAvailable:()=>false},async()=>{},()=>{},authOrigin);await a.signUp('student@example.test','test-password-123','Student');expect(a.remembered).toBe(false);expect(fs.existsSync(path.join(root,'session.enc'))).toBe(false);});
  it('keeps unverified edits local, then synchronizes after email verification',async()=>{const a=auth();await a.signUp('student@example.test','test-password-123','Student');const d=device(a);d.s.save(item());await d.e.sync();expect(d.e.status.state).toBe('verification');expect(d.s.queue()).toHaveLength(1);});
  it('converges across two isolated devices after saves and deletions',async()=>{const a=await verifiedAccount();const x=device(a),y=device(a),v=item();x.s.save(v);await x.e.sync();expect(x.e.status.state).toBe('synced');await y.e.sync();expect(y.s.get(v.id)).toEqual(v);y.s.remove(v.id);await y.e.sync();await x.e.sync();expect(x.s.get(v.id)).toBeNull();expect(x.s.queue()).toHaveLength(0);});
  it('preserves conflicting offline edits until a checked resolution',async()=>{const a=await verifiedAccount();const x=device(a),y=device(a),v=item();x.s.save(v);await x.e.sync();await y.e.sync();x.s.save({...v,title:'Device A'});y.s.save({...v,title:'Device B'});await x.e.sync();await y.e.sync();expect(y.e.status.state).toBe('conflict');expect((y.s.get(v.id) as any).title).toBe('Device B');const conflict=y.s.conflicts()[0];y.s.resolve(conflict.id,'both',await y.c.get(v.id));await y.e.sync();await x.e.sync();expect(x.s.list().filter(r=>r.kind==='item').map(r=>r.title).sort()).toEqual(['Device A','Device B']);});
  it('recovers a committed write whose response was lost',async()=>{const a=await verifiedAccount();const x=device(a);const v=item();x.s.save(v);const m=x.s.queue()[0];x.s.markSending(m.id);await x.c.commit(m);x.s.resetMutation(m.id);await x.e.sync();expect(await x.c.head()).toBe(1);expect(x.s.queue()).toHaveLength(0);});
  it('holds the completed cursor if a pull fails partway through a page',async()=>{const a=await verifiedAccount();const x=device(a);const v=item();await x.c.commit({id:randomUUID(),order:1,recordId:v.id,value:v,base:null,baseVersion:null,state:'pending',attempts:0});const original=x.c.changes.bind(x.c);x.c.changes=async()=>{throw new Error('offline');};await x.e.sync();expect(x.s.metadata('cursor',0)).toBe(0);x.c.changes=original;await x.e.sync();expect(x.s.metadata('cursor',0)).toBe(1);expect(x.s.get(v.id)).toEqual(v);});
});
