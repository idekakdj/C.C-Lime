import { afterEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DateTime } from 'luxon';
import { expand, timingLabel, reminderCandidates } from '../../src/domain/calendar';
import { exportCalendar, parseCalendar } from '../../src/domain/interchange';
import { ReminderScheduler } from '../../src/main/scheduler';
import { LocalStore } from '../../src/main/store';
import { defaultDeviceSettings, type CalendarItem } from '../../src/shared/model';
import { item, recurrence, millis } from '../fixtures';
const roots:string[]=[],stores:LocalStore[]=[];
afterEach(()=>{stores.splice(0).forEach(s=>s.close());for(const root of roots.splice(0))if(root.startsWith(path.join(os.tmpdir(),'cc-lime-review-')))fs.rmSync(root,{recursive:true,force:true});});
describe('review regressions',()=>{
  it('schedules an occurrence-only reminder when its repeating master has none',()=>{
    const value=item({recurrence:recurrence({frequency:'DAILY',count:3}),reminders:[]});
    const override={id:randomUUID(),kind:'exception' as const,seriesId:value.id,originalDate:'2026-09-19',cancelled:false,override:{reminders:[{id:randomUUID(),minutesBefore:15}]}};
    const candidates=reminderCandidates([value,override],millis('2026-09-18T08:00'),'America/Toronto');
    expect(candidates).toHaveLength(1);expect(candidates[0].item.originalDate).toBe('2026-09-19');
  });
  it('labels date-only deadlines with their actual date',()=>{const value=item({itemType:'assignment',timing:{mode:'deadline',date:'2026-09-25',time:null,anchorTime:'09:00',zone:'America/Toronto'}});expect(timingLabel(expand([value],'2026-09-24','2026-09-27','America/Toronto')[0],'America/Toronto')).toBe('Due Sep 25');});
  it.each([null,'23:30'])('round trips deadline dates, time, zone and anchor (%s)',time=>{const value=item({itemType:'assignment',timing:{mode:'deadline',date:'2026-09-25',time,anchorTime:'08:30',zone:'America/Toronto'}});const parsed=parseCalendar(exportCalendar([value],{zone:'UTC'}),{zone:'UTC'});expect(parsed.invalid).toBe(0);expect((parsed.records[0]as CalendarItem).timing).toEqual(value.timing);});
  it('exports a title-only occurrence edit on the original occurrence date',()=>{const value=item({recurrence:recurrence({frequency:'DAILY',count:5})});const exception={id:randomUUID(),kind:'exception' as const,seriesId:value.id,originalDate:'2026-09-20',cancelled:false,override:{title:'Special lecture'}};const parsed=parseCalendar(exportCalendar([value,exception],{zone:'America/Toronto'}),{zone:'America/Toronto'});const changed=expand(parsed.records,'2026-09-18','2026-09-24','America/Toronto').find(o=>o.title==='Special lecture');expect(changed?.date).toBe('2026-09-20');});
  it('converts unsupported recurrence using the source IANA zone',()=>{const text='BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:hourly-zone\r\nSUMMARY:Lab\r\nDTSTART;TZID=America/Toronto:20260925T090000\r\nDTEND;TZID=America/Toronto:20260925T100000\r\nRRULE:FREQ=HOURLY;COUNT=3\r\nEND:VEVENT\r\nEND:VCALENDAR';const parsed=parseCalendar(text,{zone:'UTC',finiteRange:{from:'2026-09-25',to:'2026-09-25'}});expect(parsed.invalid).toBe(0);expect(parsed.records).toHaveLength(3);expect((parsed.records[0]as CalendarItem).timing).toMatchObject({start:'2026-09-25T13:00:00.000Z'});});
  it('reopens a completed task reminder only when its unchanged due time is still ahead',()=>{
    const root=fs.mkdtempSync(path.join(os.tmpdir(),'cc-lime-review-'));roots.push(root);const store=new LocalStore(root,'test');stores.push(store);let now=millis('2026-09-18T08:30'),count=0;
    const value=item({reminders:[{id:randomUUID(),minutesBefore:15}]});store.save(value);
    const scheduler=new ReminderScheduler(store,()=>({...defaultDeviceSettings,notifications:true}),()=> 'America/Toronto',()=>count++,()=>{},()=>now);
    scheduler.reconcile(false);store.save({...value,status:'completed'});scheduler.reconcile(false);expect(store.reminders()[0].state).toBe('canceled');store.save(value);scheduler.reconcile(false);expect(store.reminders()[0].state).toBe('pending');now=millis('2026-09-18T08:45');scheduler.reconcile(false);expect(count).toBe(1);
    store.save({...value,status:'completed'});scheduler.reconcile(false);store.save(value);scheduler.reconcile(false);expect(count).toBe(1);scheduler.stop();
  });
  it('converts UTC recurrence end to the source calendar date',()=>{const value=item({timing:{mode:'timed',start:'2026-09-19T03:30:00Z',end:'2026-09-19T04:00:00Z',zone:'America/Toronto'},recurrence:recurrence({frequency:'DAILY',until:'2026-09-21'})});const parsed=parseCalendar(exportCalendar([value],{zone:'UTC'}),{zone:'UTC'});expect((parsed.records[0]as CalendarItem).recurrence?.until).toBe('2026-09-21');expect(expand(parsed.records,'2026-09-18','2026-09-24','America/Toronto')).toHaveLength(4);});
});
