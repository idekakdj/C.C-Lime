import { afterEach, expect, it } from 'vitest';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import { ApplicationService, type HostServices } from '../../src/main/service';
import { parseCalendar } from '../../src/domain/interchange';
import { item, recurrence } from '../fixtures';
import { expand } from '../../src/domain/calendar';
const entries:Array<{root:string;service:ApplicationService}>=[];
async function setup(file?:string){const root=fs.mkdtempSync(path.join(os.tmpdir(),'cc-lime-service-'));const host:HostServices={secure:{isEncryptionAvailable:()=>false,encryptString:()=>Buffer.alloc(0),decryptString:()=>''},openBrowser:async()=>{},changed:()=>{},notify:()=>{},openFile:async()=>file??null,saveFile:async()=>null,setStartup:()=>{},startupStatus:()=>({enabled:false,wasOpenedAtLogin:false}),dataFolder:()=>{},version:'test'};const service=new ApplicationService(root,null,host);entries.push({root,service});await service.command('localPreview',null);return{root,service};}
afterEach(async()=>{for(const{root,service}of entries.splice(0)){await service.close();if(root.startsWith(path.join(os.tmpdir(),'cc-lime-service-')))fs.rmSync(root,{recursive:true,force:true});}});
it('detaches an edited completed occurrence without losing its date or history',async()=>{
  const{service}=await setup();const series=item({recurrence:recurrence({frequency:'DAILY',count:5})});
  await service.command('save',series);
  await service.command('occurrence',{seriesId:series.id,date:'2026-09-20',action:'save',override:{title:'Moved seminar',timing:{mode:'timed',start:'2026-09-23T13:00:00Z',end:'2026-09-23T14:00:00Z',zone:'America/Toronto'}}});
  await service.command('occurrence',{seriesId:series.id,date:'2026-09-20',action:'complete'});
  await expect(service.command('save',{...series,recurrence:{...series.recurrence!,count:2}})).rejects.toThrow('completion history');
  await service.command('occurrence',{seriesId:series.id,date:'2026-09-20',action:'detach'});
  const detached=service.store!.list().find(r=>r.kind==='item'&&r.id!==series.id);
  expect(detached).toMatchObject({title:'Moved seminar',recurrence:null,status:'completed',timing:{start:'2026-09-23T13:00:00Z'}});
  const linked=service.store!.queue().slice(-3);expect(new Set(linked.map(q=>q.groupId)).size).toBe(1);expect(linked[0].groupId).toBeTruthy();
  await service.command('save',{...series,recurrence:{...series.recurrence!,count:2}});
  const occurrences=expand(service.store!.list(),'2026-09-18','2026-09-25','America/Toronto');
  expect(occurrences).toHaveLength(3);expect(occurrences.filter(o=>o.title==='Moved seminar')).toHaveLength(1);
});
it('removes only the selected local account after exact confirmation',async()=>{const{root,service}=await setup();await service.command('save',item());const directory=service.store!.directory;fs.mkdirSync(path.join(root,'.local'));fs.writeFileSync(path.join(root,'.local','keep.txt'),'configuration');await expect(service.command('local.remove',{confirmation:'yes'})).rejects.toThrow();expect(fs.existsSync(directory)).toBe(true);await service.command('local.remove',{confirmation:'REMOVE'});expect(service.snapshot().records).toEqual([]);expect(service.snapshot().localMode).toBe(false);expect(fs.existsSync(directory)).toBe(false);expect(fs.readFileSync(path.join(root,'.local','keep.txt'),'utf8')).toBe('configuration');});
it('stops reminders and denies calendar access immediately after session revocation',async()=>{const{service}=await setup();await service.command('save',item());(service as any).localMode=false;service.auth.session={uid:'different-account',email:'student@example.test',displayName:'Student',providers:['password'],verified:true};expect(service.snapshot().records).toEqual([]);service.auth.signOut();await expect(service.command('save',item())).rejects.toThrow('Open a calendar account');await new Promise(resolve=>setTimeout(resolve,0));expect(service.scheduler).toBe(null);expect(service.store).toBe(null);});
it('refuses to replace a calendar item that changed after import preview',async()=>{const{root,service}=await setup();const file=path.join(root,'calendar.ics'),text='BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:stable\r\nSUMMARY:From file\r\nDTSTART:20260924T130000Z\r\nDTEND:20260924T140000Z\r\nEND:VEVENT\r\nEND:VCALENDAR';fs.writeFileSync(file,text);(service as any).host.openFile=async()=>file;(service as any).work=async(_type:string,payload:any)=>parseCalendar(payload.text,payload.options);const existing=item({sourceUid:'stable',title:'Existing'});await service.command('save',existing);const preview=await service.command('import.preview',{zone:'UTC'});await service.command('save',{...existing,title:'Edited after preview'});await expect(service.command('import.commit',{token:preview.token,includeChanged:true})).rejects.toThrow('changed after this preview');expect(service.store!.get(existing.id)).toMatchObject({title:'Edited after preview'});});
