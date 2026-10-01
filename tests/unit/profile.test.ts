import { afterEach, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { LocalStore } from '../../src/main/store';
import { ApplicationService, type HostServices } from '../../src/main/service';
import { avatarDimensions, readAvatar, MAX_AVATAR_BYTES } from '../../src/main/avatar';
import type { PreparedAvatar } from '../../src/main/avatar';
import { centeredCrop } from '../../src/shared/avatar-crop';
import { profileSchema, PROFILE_ID, type DomainRecord } from '../../src/shared/model';
import { activePalette, defaultAppearance, appearanceSchema, contrast, foreground, paletteSchema, presets } from '../../src/shared/appearance';
import { createBackup, readBackup, remapBackup } from '../../src/domain/interchange';
import { item, recurrence } from '../fixtures';

const roots:string[]=[], stores:LocalStore[]=[],services:ApplicationService[]=[];
function root(){const folder=fs.mkdtempSync(path.join(os.tmpdir(),'cc-lime-profile-'));roots.push(folder);return folder;}
function store(account='alice',folder=root()){const db=new LocalStore(folder,account);stores.push(db);return db;}
const photo='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jYykAAAAASUVORK5CYII=';
const profile=()=>profileSchema.parse({id:PROFILE_ID,kind:'profile',name:'Student',avatar:photo,joinedAt:'2024-09-01T00:00:00.000Z',appearance:{active:'purple',custom:[]}});
const selection=():PreparedAvatar=>({preview:photo,width:1,height:1,render:()=>photo});
async function service(chooseAvatar:HostServices['chooseAvatar']=async()=>selection()){const host:HostServices={secure:{isEncryptionAvailable:()=>false,encryptString:()=>Buffer.alloc(0),decryptString:()=>''},openBrowser:async()=>{},changed:()=>{},notify:()=>{},openFile:async()=>null,saveFile:async()=>null,setStartup:()=>{},startupStatus:()=>({enabled:false,wasOpenedAtLogin:false}),dataFolder:()=>{},version:'test',chooseAvatar};const result=new ApplicationService(root(),null,host);services.push(result);await result.command('localPreview',null);return result;}
afterEach(async()=>{for(const s of services.splice(0))await s.close();for(const s of stores.splice(0))s.close();for(const folder of roots.splice(0)){expect(path.dirname(folder)).toBe(os.tmpdir());expect(path.basename(folder)).toMatch(/^cc-lime-profile-/);fs.rmSync(folder,{recursive:true,force:true});}});
it('retains profile photo, name, join date and three themes across restart and isolates accounts',()=>{
 const folder=root(),a=store('alice',folder),b=store('bob',folder),value=profile();value.appearance.custom=Array.from({length:3},(_,i)=>({id:randomUUID(),name:`Theme ${i}`,colors:{background:'#111111',surface:'#222222',accent:'#abcdef'}}));value.appearance.active=value.appearance.custom[2].id;a.save(value);a.close();expect(store('alice',folder).get(PROFILE_ID)).toEqual(value);expect(b.get(PROFILE_ID)).toBeNull();
});
it('backs up schema-one data before advancing the profile-aware schema',()=>{
 const folder=root(),original=store('alice',folder),task=item();original.save(task);original.db.pragma('user_version = 1');original.close();const upgraded=store('alice',folder);expect(upgraded.db.pragma('user_version',{simple:true})).toBe(2);expect(upgraded.get(task.id)).toEqual(task);expect(fs.readdirSync(path.join(upgraded.directory,'backups')).some(name=>name.startsWith('pre-profile-migration-'))).toBe(true);
});
it('rejects invalid, fourth, duplicate and unavailable custom themes',()=>{
 const custom=Array.from({length:4},()=>({id:randomUUID(),name:'Theme',colors:{background:'#111111',surface:'#222222',accent:'#abcdef'}}));
 for(const value of [{active:'purple',custom},{active:'purple',custom:[custom[0],custom[0]]},{active:'missing',custom:[]},{active:'purple',custom:[{...custom[0],name:''}]},{active:'purple',custom:[{...custom[0],colors:{...custom[0].colors,accent:'red'}}]}])expect(appearanceSchema.safeParse(value).success).toBe(false);
 expect(paletteSchema.safeParse({background:'#ffffff',surface:'#000000',accent:'#ffffff'}).success).toBe(false);
});
it('chooses readable foregrounds for every preset and both light and dark custom surfaces',()=>{
 expect(paletteSchema.safeParse(activePalette(defaultAppearance)).success).toBe(true);
 for(const p of [...presets,{background:'#ffffff',surface:'#eeeeee',accent:'#333333'}]){const ink=foreground(p.background,p.surface);expect(contrast(ink,p.background)).toBeGreaterThanOrEqual(4.5);expect(contrast(ink,p.surface)).toBeGreaterThanOrEqual(4.5);expect(contrast(foreground(p.accent),p.accent)).toBeGreaterThanOrEqual(4.5);}
});
it('counts a task once across reopen, re-completion, deletion and restart',()=>{
 const folder=root(),s=store('alice',folder),task=item({itemType:'task',status:'completed',completedAt:'2026-09-01T10:00:00Z'});s.save(task);s.save({...task,status:'open',completedAt:null});s.save(task);s.remove(task.id);s.close();const reopened=store('alice',folder);expect(reopened.list().filter(r=>r.kind==='completion')).toHaveLength(1);expect(reopened.list().filter(r=>r.kind==='item')).toHaveLength(0);
});
it('counts recurring study occurrences separately and excludes ordinary events',()=>{
 const s=store(),study=item({itemType:'study',recurrence:recurrence()}),event=item({status:'completed'});s.save(study);s.save(event);
 for(const date of ['2026-09-18','2026-09-25']){const state={id:randomUUID(),kind:'occurrenceState' as const,seriesId:study.id,originalDate:date,status:'completed' as const,completedAt:`${date}T10:00:00Z`};s.save(state);s.save(state);}
 expect(s.list().filter(r=>r.kind==='completion')).toHaveLength(2);
});
it('rolls back completion and its queue when progress history cannot be stored',()=>{
 const s=store(),task=item({itemType:'task'});s.save(task);const before=s.queueCount();s.db.exec("CREATE TRIGGER reject_progress BEFORE INSERT ON records WHEN NEW.kind='completion' BEGIN SELECT RAISE(ABORT, 'synthetic write failure'); END");
 expect(()=>s.save({...task,status:'completed'})).toThrow('synthetic write failure');expect(s.get(task.id)).toEqual(task);expect(s.queueCount()).toBe(before);
});
it('seeds available older completed history idempotently',()=>{
 const s=store(),task=item({itemType:'task',status:'completed'});s.applyRemote([{id:task.id,value:task,version:'v1',sequence:1}]);s.retainCompletionHistory();s.retainCompletionHistory();expect(s.list().filter(r=>r.kind==='completion')).toHaveLength(1);expect(s.queueCount()).toBe(1);
});
it('deduplicates simultaneous device completion records without a user conflict',()=>{
 const task=item({itemType:'task',status:'completed'}),a=store('alice'),b=store('alice');a.save(task);b.save({...task,completedAt:'2026-09-29T10:00:00Z'});const mutation=b.queue().find(m=>m.value?.kind==='completion')!,value=a.list().find(r=>r.kind==='completion')!;b.conflict(mutation,{id:value.id,value,version:'remote',sequence:3});expect(b.conflicts()).toHaveLength(0);expect(b.list().filter(r=>r.kind==='completion')).toEqual([value]);
});
it('same-account backup retains profile/history while foreign transfer excludes personal identity/history',()=>{
 const s=store();s.save(profile());s.save(item({itemType:'task',status:'completed'}));const decoded=readBackup(createBackup('alice',s.list())).records;expect(decoded).toEqual(s.list());const foreign=remapBackup(decoded);expect(foreign.some(r=>r.kind==='profile'||r.kind==='completion')).toBe(false);expect(foreign.filter(r=>r.kind==='item')).toHaveLength(1);
});
it('profile cannot be duplicated by keep-both conflict handling or removed as a calendar item',()=>{
 const s=store(),value=profile();s.save(value);s.conflict(s.queue()[0],{id:value.id,value:{...value,name:'Remote'},version:'v1',sequence:1});expect(()=>s.resolve(s.conflicts()[0].id,'both',{id:value.id,value:{...value,name:'Remote'},version:'v1',sequence:1})).toThrow('Choose one');expect(()=>s.remove(value.id)).toThrow('profile controls');
});
it('photo upload and removal persist while cancellation preserves the current icon',async()=>{
 const chooser=vi.fn().mockResolvedValueOnce(selection()).mockResolvedValueOnce(null),s=await service(chooser);const draft=await s.command('profile.photo',null);expect(s.snapshot().profile?.avatar).toBeNull();await s.command('profile.photo.save',{token:draft.token,adjustment:centeredCrop});expect(s.snapshot().profile?.avatar).toBe(photo);await s.command('profile.photo',null);expect(s.snapshot().profile?.avatar).toBe(photo);await s.command('profile.removePhoto',null);expect(s.snapshot().profile?.avatar).toBeNull();
});
it('a photo selected for a previous account cannot be written after sign-out',async()=>{
 let resolve!:(value:PreparedAvatar)=>void;const s=await service(()=>new Promise(r=>{resolve=r;}));const operation=s.command('profile.photo',null);await s.command('auth.signOut',null);resolve(selection());await expect(operation).rejects.toThrow('Open a calendar');
});
it('limits repeated photo selection before opening another picker',async()=>{
 const chooser=vi.fn().mockResolvedValue(null),s=await service(chooser);for(let i=0;i<6;i++)await s.command('profile.photo',null);await expect(s.command('profile.photo',null)).rejects.toThrow('Please wait');expect(chooser).toHaveBeenCalledTimes(6);
});
it('rejects invalid source images and excessive dimensions or bytes before decode',()=>{
 expect(()=>avatarDimensions(Buffer.alloc(MAX_AVATAR_BYTES+1))).toThrow('5 MiB');expect(()=>avatarDimensions(Buffer.from('<svg/>'))).toThrow('valid PNG');
 const png=Buffer.from(photo.split(',')[1],'base64');expect(avatarDimensions(png)).toEqual({width:1,height:1});png.writeUInt32BE(100000,16);expect(()=>avatarDimensions(png)).toThrow('4,096');const folder=root(),file=path.join(folder,'bad.png');fs.writeFileSync(file,png);const decoder=vi.fn();expect(()=>readAvatar(file,decoder)).toThrow();expect(decoder).not.toHaveBeenCalled();
});
it('bounds JPEG segment parsing and recognizes supported frame dimensions',()=>{
 const jpeg=Buffer.from([255,216,255,192,0,11,8,0,20,0,30,1,1,0x11,0]);expect(avatarDimensions(jpeg)).toEqual({width:30,height:20});jpeg[4]=255;expect(()=>avatarDimensions(jpeg)).toThrow();
});
it('cancel and stale/replayed previews cannot change the icon',async()=>{
 const s=await service();s.store!.save(profile());const first=await s.command('profile.photo',null);await s.command('profile.photo.cancel',{token:first.token});await expect(s.command('profile.photo.save',{token:first.token,adjustment:centeredCrop})).rejects.toThrow('expired or changed');expect(s.snapshot().profile?.avatar).toBe(photo);
 const next=await s.command('profile.photo',null);await s.command('profile.photo.save',{token:next.token,adjustment:centeredCrop});await expect(s.command('profile.photo.save',{token:next.token,adjustment:centeredCrop})).rejects.toThrow('expired or changed');
});
it('crop saves preserve newer name/theme edits and remain retryable after SQLite failure',async()=>{
 const s=await service(),draft=await s.command('profile.photo',null);await s.command('profile.save',{name:'New username'});await s.command('appearance',{active:'navy',custom:[]});
 s.store!.db.exec("CREATE TRIGGER reject_photo BEFORE INSERT ON records WHEN NEW.kind='profile' BEGIN SELECT RAISE(ABORT, 'synthetic crop write failure'); END");
 await expect(s.command('profile.photo.save',{token:draft.token,adjustment:centeredCrop})).rejects.toThrow('synthetic crop write failure');expect(s.snapshot().profile?.avatar).toBeNull();
 s.store!.db.exec('DROP TRIGGER reject_photo');await s.command('profile.photo.save',{token:draft.token,adjustment:centeredCrop});expect(s.snapshot().profile).toMatchObject({name:'New username',avatar:photo,appearance:{active:'navy'}});
},15000); // Keep rollback/retry assertions while allowing bounded Windows CI disk latency.
it('expiry, remote-photo replacement and removal invalidate crop commits',async()=>{
 const s=await service();let draft=await s.command('profile.photo',null);const clock=vi.spyOn(performance,'now').mockReturnValue(performance.now()+600001);
 try{await expect(s.command('profile.photo.save',{token:draft.token,adjustment:centeredCrop})).rejects.toThrow('expired or changed');}finally{clock.mockRestore();}
 draft=await s.command('profile.photo',null);s.store!.save(profile());await expect(s.command('profile.photo.save',{token:draft.token,adjustment:centeredCrop})).rejects.toThrow('expired or changed');
 draft=await s.command('profile.photo',null);await s.command('profile.removePhoto',null);await expect(s.command('profile.photo.save',{token:draft.token,adjustment:centeredCrop})).rejects.toThrow('expired or changed');expect(s.snapshot().profile?.avatar).toBeNull();
});
it('only the newest picker may produce a commit draft',async()=>{
 const callbacks:Array<(value:PreparedAvatar)=>void>=[];const s=await service(()=>new Promise(resolve=>callbacks.push(resolve)));const first=s.command('profile.photo',null),second=s.command('profile.photo',null);
 callbacks[1](selection());const draft=await second;callbacks[0](selection());await expect(first).rejects.toThrow('selection changed');await s.command('profile.photo.save',{token:draft.token,adjustment:centeredCrop});expect(s.snapshot().profile?.avatar).toBe(photo);
});
