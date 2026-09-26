import { afterEach, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { courseSchema, semesterSchema, preferencesSchema } from '../../src/shared/model';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import { ApplicationService, type HostServices } from '../../src/main/service';
import { parseCalendar } from '../../src/domain/interchange';
import { item, recurrence } from '../fixtures';
import { expand } from '../../src/domain/calendar';
const entries:Array<{root:string;service:ApplicationService}>=[];
async function setup(file?:string){const root=fs.mkdtempSync(path.join(os.tmpdir(),'cc-lime-service-'));const host:HostServices={secure:{isEncryptionAvailable:()=>false,encryptString:()=>Buffer.alloc(0),decryptString:()=>''},openBrowser:async()=>{},changed:()=>{},notify:()=>{},openFile:async()=>file??null,saveFile:async()=>null,setStartup:()=>{},startupStatus:()=>({enabled:false,wasOpenedAtLogin:false}),dataFolder:()=>{},version:'test'};const service=new ApplicationService(root,null,host);entries.push({root,service});await service.command('localPreview',null);return{root,service};}
afterEach(async()=>{for(const{root,service}of entries.splice(0)){await service.close();if(root.startsWith(path.join(os.tmpdir(),'cc-lime-service-')))fs.rmSync(root,{recursive:true,force:true});}});
it('omits unchanged calendar records from requested updates but reloads on edits, sign-out and store reopening',async()=>{
  const {service}=await setup(),value=item();await service.command('save',value);const first=await service.command('snapshot',null);
  await service.command('device',{view:'week'});const update=await service.command('snapshot',{recordsRevision:first.recordsRevision});expect(update.records).toBeUndefined();expect(update.device.view).toBe('week');
  await service.command('save',{...value,title:'Changed'});const edited=await service.command('snapshot',{recordsRevision:first.recordsRevision});expect(edited.records[0].title).toBe('Changed');
  await service.command('auth.signOut',null);expect((await service.command('snapshot',{recordsRevision:edited.recordsRevision})).records).toEqual([]);
  await service.command('localPreview',null);const reopened=await service.command('snapshot',{recordsRevision:edited.recordsRevision});expect(reopened.records).toHaveLength(1);expect(reopened.recordsRevision).not.toBe(edited.recordsRevision);
  await expect(service.command('snapshot',{recordsRevision:'x'.repeat(201)})).rejects.toThrow();
});
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

it('reviews series changes without writes and atomically preserves removed history with undo',async()=>{
  const{service}=await setup(),before=item({recurrence:recurrence({frequency:'DAILY',count:5})});await service.command('save',before);
  await service.command('occurrence',{seriesId:before.id,date:'2026-09-20',action:'save',override:{title:'Edited meeting'}});await service.command('occurrence',{seriesId:before.id,date:'2026-09-20',action:'complete'});
  const original=service.store!.list(),revision=service.store!.listRevision(),after={...before,recurrence:recurrence({frequency:'DAILY',count:2})};
  const preview=await service.command('schedule.preview',{value:after});expect(preview.historyCount).toBe(1);expect(service.store!.listRevision()).toBe(revision);expect(service.store!.list()).toEqual(original);
  const result=await service.command('schedule.commit',{token:preview.token,history:'preserve'});
  expect(service.store!.list().filter(r=>r.kind==='item')).toHaveLength(2);expect(service.store!.list().find(r=>r.kind==='item'&&r.id!==before.id)).toMatchObject({title:'Edited meeting',status:'completed',recurrence:null});
  expect(service.store!.list().some(r=>r.kind==='exception'||r.kind==='occurrenceState')).toBe(false);
  await expect(service.command('schedule.commit',{token:preview.token,history:'preserve'})).rejects.toThrow('expired');
  await service.command('undo',{token:result.undoToken});expect(service.store!.list().sort((a,b)=>a.id.localeCompare(b.id))).toEqual([...original].sort((a,b)=>a.id.localeCompare(b.id)));
});

it('requires a fresh schedule preview after another edit, cancellation, expiration or account switch',async()=>{
  const{service}=await setup(),before=item({recurrence:recurrence({count:5})});await service.command('save',before);
  const preview=async()=>service.command('schedule.preview',{value:{...before,title:'Proposed'}});
  let review=await preview();await service.command('save',item({title:'Unrelated edit'}));await expect(service.command('schedule.commit',{token:review.token,history:'preserve'})).rejects.toThrow('changed after');
  review=await preview();await service.command('schedule.cancel',null);await expect(service.command('schedule.commit',{token:review.token,history:'preserve'})).rejects.toThrow('expired');
  review=await preview();const now=Date.now();const clock=vi.spyOn(Date,'now').mockReturnValue(now+11*60*1000);try{await expect(service.command('schedule.commit',{token:review.token,history:'preserve'})).rejects.toThrow('expired');}finally{clock.mockRestore();}
  review=await preview();await service.command('auth.signOut',null);await service.command('localPreview',null);await expect(service.command('schedule.commit',{token:review.token,history:'preserve'})).rejects.toThrow('expired');
  expect(service.store!.get(before.id)).toMatchObject({title:before.title});
});

it('allows explicit history discard but never silently chooses it',async()=>{
  const{service}=await setup(),before=item({recurrence:recurrence({frequency:'DAILY',count:3})});await service.command('save',before);await service.command('occurrence',{seriesId:before.id,date:'2026-09-20',action:'complete'});
  const preview=await service.command('schedule.preview',{value:{...before,recurrence:recurrence({frequency:'DAILY',count:1})}});
  await expect(service.command('schedule.commit',{token:preview.token})).rejects.toThrow();expect(service.store!.list().some(r=>r.kind==='occurrenceState')).toBe(true);
  await service.command('schedule.commit',{token:preview.token,history:'discard'});expect(service.store!.list()).toHaveLength(1);
});

it('changes linked repeating classes only, and supports saving semester details without shifting any classes',async()=>{
  const{service}=await setup(),semester=semesterSchema.parse({id:randomUUID(),kind:'semester',name:'Fall',startDate:'2026-09-01',endDate:'2026-12-20',zone:'America/Toronto'});
  const course=courseSchema.parse({id:randomUUID(),kind:'course',name:'Algorithms',semesterId:semester.id});await service.command('save',semester);await service.command('save',course);
  const lecture=item({itemType:'class',courseId:course.id,recurrence:recurrence({until:semester.endDate})}),exam=item({itemType:'exam',courseId:course.id}),assignment=item({itemType:'assignment',courseId:course.id}),unlinked=item({itemType:'class',recurrence:recurrence({count:4})});
  for(const value of [lecture,exam,assignment,unlinked])await service.command('save',value);
  const next={...semester,endDate:'2026-10-31',breaks:[{startDate:'2026-09-25',endDate:'2026-09-25'}]};let preview=await service.command('schedule.preview',{value:next});expect(preview.series.map((s:any)=>s.id)).toEqual([lecture.id]);
  const result=await service.command('schedule.commit',{token:preview.token,history:'preserve',applyTimetable:false});expect(service.store!.get(lecture.id)).toEqual(lecture);expect(service.store!.get(semester.id)).toEqual(next);await service.command('undo',{token:result.undoToken});
  preview=await service.command('schedule.preview',{value:next});await service.command('schedule.commit',{token:preview.token,history:'preserve'});
  expect(service.store!.get(lecture.id)).toMatchObject({recurrence:{until:next.endDate,excludedDates:['2026-09-25']}});
  for(const unchanged of [exam,assignment,unlinked])expect(service.store!.get(unchanged.id)).toEqual(unchanged);
});

it('follows changes to the computer zone without rewriting calendar preferences or item instants',async()=>{
  const{service,root}=await setup();const prefs=preferencesSchema.parse({id:randomUUID(),kind:'preferences',zone:'America/Toronto'}),value=item();await service.command('save',prefs);await service.command('save',value);
  let systemZone='Europe/London';(service as any).host.timeZone=()=>systemZone;expect(service.snapshot().displayZone).toBe(prefs.zone);
  const revision=service.store!.listRevision();await service.command('device',{followZone:true});expect(service.snapshot().displayZone).toBe('Europe/London');systemZone='Asia/Tokyo';service.resume();expect(service.snapshot().displayZone).toBe('Asia/Tokyo');expect(service.store!.listRevision()).toBe(revision);expect(service.store!.get(value.id)).toEqual(value);expect(service.store!.get(prefs.id)).toEqual(prefs);
  const host=(service as any).host as HostServices;await service.close();const restarted=new ApplicationService(root,null,host);entries.find(entry=>entry.service===service)!.service=restarted;await restarted.command('localPreview',null);expect(restarted.device.followZone).toBe(true);expect(restarted.snapshot().displayZone).toBe('Asia/Tokyo');
  await restarted.command('device',{followZone:false});expect(restarted.snapshot().displayZone).toBe(prefs.zone);await restarted.command('device',{followZone:true});systemZone='not-a-real-zone';expect(restarted.snapshot().displayZone).toBe(prefs.zone);
});

it('reports synchronous and asynchronous native test-notification failures without claiming banner delivery',async()=>{
  const{service}=await setup();let failure=()=>{};(service as any).host.notify=(notice:any)=>{failure=notice.onFailure;};
  expect(await service.command('testNotification',null)).toMatchObject({state:'submitted'});expect(service.snapshot().notificationTest?.message).toContain('does not confirm');failure();expect(service.snapshot().notificationTest).toMatchObject({state:'failed'});
  const oldFailure=failure;await service.command('testNotification',null);oldFailure();expect(service.snapshot().notificationTest?.state).toBe('submitted');
  (service as any).host.notify=(notice:any)=>notice.onFailure();expect(await service.command('testNotification',null)).toMatchObject({state:'failed'});
  (service as any).host.notify=()=>{throw new Error('native failure');};expect(await service.command('testNotification',null)).toMatchObject({state:'failed'});
});
