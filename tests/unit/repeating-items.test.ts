import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { DateTime } from 'luxon';
import { expand, reminderCandidates, upcoming } from '../../src/domain/calendar';
import { createBackup, readBackup, exportCalendar, parseCalendar } from '../../src/domain/interchange';
import { item, recurrence } from '../fixtures';
import type { ItemType, Timing, DomainRecord } from '../../src/shared/model';

const types:ItemType[]=['class','event','assignment','exam','study','task'];
describe('every scheduled item can repeat',()=>{
 it.each(types)('%s supports distinct timed occurrences',itemType=>{
  const value=item({itemType,recurrence:recurrence({frequency:'DAILY',count:3,weekdays:[]})});
  const occurrences=expand([value],'2026-09-18','2026-09-22','America/Toronto');
  expect(occurrences.map(o=>o.originalDate)).toEqual(['2026-09-18','2026-09-19','2026-09-20']);expect(new Set(occurrences.map(o=>o.occurrenceKey)).size).toBe(3);
 });
 it.each(['event','assignment','exam','task'] as ItemType[])('%s supports all-day and deadline repetition',itemType=>{
  const timings:Timing[]=[{mode:'allDay',startDate:'2026-03-07',endDate:'2026-03-08',zone:'America/Toronto',anchorTime:'09:00'},...([null,'09:00'] as const).map(time=>({mode:'deadline' as const,date:'2026-03-07',time,zone:'America/Toronto',anchorTime:'09:00'}))];
  for(const timing of timings){const value=item({itemType,timing,recurrence:recurrence({frequency:'DAILY',count:3,weekdays:[]})});const results=expand([value],'2026-03-07','2026-03-11','America/Toronto');expect(results.map(o=>o.date)).toEqual(['2026-03-07','2026-03-08','2026-03-09']);expect(results.map(o=>DateTime.fromMillis(o.startMs!,{zone:'America/Toronto'}).toFormat('HH:mm'))).toEqual(['09:00','09:00','09:00']);expect(results[1].startMs!-results[0].startMs!).toBe(23*3600000);}
 });
 it('completes only one recurring deadline while keeping subsequent reminders and tasks open',()=>{
  const value=item({itemType:'task',timing:{mode:'deadline',date:'2026-09-18',time:'09:00',zone:'UTC',anchorTime:'09:00'},recurrence:recurrence({frequency:'DAILY',count:3,weekdays:[]}),reminders:[{id:randomUUID(),minutesBefore:15}]});
  const records:DomainRecord[]=[value,{id:randomUUID(),kind:'occurrenceState',seriesId:value.id,originalDate:'2026-09-18',status:'completed',completedAt:'2026-09-18T08:00:00Z'}];
  const now=DateTime.fromISO('2026-09-18T08:30Z').toMillis();expect(upcoming(records,now,'UTC').upcoming.map(o=>o.originalDate)).toEqual(['2026-09-19','2026-09-20']);expect(reminderCandidates(records,now,'UTC').map(r=>r.item.originalDate)).toEqual(['2026-09-19','2026-09-20']);
 });
 it.each([null,'23:30'] as const)('round trips deadline %s with repeat exclusions, extra dates and overrides through ICS and backup',time=>{
  const value=item({itemType:'assignment',timing:{mode:'deadline',date:'2026-03-07',time,zone:'America/Toronto',anchorTime:'09:00'},recurrence:recurrence({frequency:'DAILY',until:'2026-03-10',weekdays:[],excludedDates:['2026-03-08'],extraDates:['2026-03-12']})});
  const records:DomainRecord[]=[value,{id:randomUUID(),kind:'exception',seriesId:value.id,originalDate:'2026-03-09',cancelled:false,override:{title:'Changed one deadline'}},{id:randomUUID(),kind:'exception',seriesId:value.id,originalDate:'2026-03-10',cancelled:true,override:{}}];
  expect(readBackup(createBackup('synthetic',records)).records).toEqual(records);
  const parsed=parseCalendar(exportCalendar(records,{zone:'America/Toronto'}),{zone:'America/Toronto'});expect(parsed.invalid).toBe(0);
  const view=(items:DomainRecord[])=>expand(items,'2026-03-07','2026-03-14','America/Toronto').map(o=>({date:o.date,title:o.title,timing:o.timing}));expect(view(parsed.records)).toEqual(view(records));
 });
});
