import { expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { DateTime } from 'luxon';
import { item, recurrence } from '../fixtures';
import { addDays, atDate, recurringDates, sourceDate } from '../../src/domain/calendar';
import { breakDates, seriesChanges, seriesImpact, semesterClass } from '../../src/domain/schedule-changes';
import { exceptionSchema, occurrenceStateSchema, semesterSchema, type DomainRecord } from '../../src/shared/model';

const semester=()=>semesterSchema.parse({id:randomUUID(),kind:'semester',name:'Fall',startDate:'2026-09-01',endDate:'2026-12-20',zone:'America/Toronto'});

it('preserves a moved, edited, completed date as one independent item and retains unaffected history',()=>{
  const before=item({recurrence:recurrence({frequency:'DAILY',count:5})}),after={...before,recurrence:recurrence({frequency:'DAILY',count:2})};
  const edit=exceptionSchema.parse({id:randomUUID(),kind:'exception',seriesId:before.id,originalDate:'2026-09-20',override:{title:'Moved lecture',notes:'Keep these notes',location:'Library',timing:atDate(before.timing,'2026-09-24')}});
  const completion=occurrenceStateSchema.parse({id:randomUUID(),kind:'occurrenceState',seriesId:before.id,originalDate:'2026-09-20',status:'completed',completedAt:'2026-09-20T14:00:00Z'});
  const retained=exceptionSchema.parse({id:randomUUID(),kind:'exception',seriesId:before.id,originalDate:'2026-09-18',override:{notes:'Retained'}});
  const records:DomainRecord[]=[before,edit,completion,retained];
  // History outside the visible preview still needs a decision.
  const preview=seriesImpact(before,after,records,'2026-09-18','2026-09-19');
  expect(preview.affectedHistory).toEqual([{date:'2026-09-20',title:'Moved lecture',completed:true}]);expect(preview.retainedHistory).toBe(1);
  const changes=seriesChanges(before,after,records,'preserve',randomUUID);
  expect(changes).toHaveLength(4);expect(changes.find(c=>c.value?.kind==='item'&&c.id!==before.id)?.value).toMatchObject({title:'Moved lecture',notes:'Keep these notes',location:'Library',timing:edit.override.timing,status:'completed',completedAt:completion.completedAt,recurrence:null,sourceUid:null});
  expect(changes.filter(c=>c.value===null).map(c=>c.id).sort()).toEqual([edit.id,completion.id].sort());expect(changes.some(c=>c.id===retained.id)).toBe(false);
  expect(records).toEqual([before,edit,completion,retained]);
  expect(seriesChanges(before,after,records,'discard',randomUUID)).toEqual([{id:after.id,value:after},{id:edit.id,value:null},{id:completion.id,value:null}]);
});

it('does not turn removed cancellations into new calendar items',()=>{
  const before=item({recurrence:recurrence({frequency:'DAILY',count:5})}),after={...before,recurrence:recurrence({frequency:'DAILY',count:1})};
  const cancellation=exceptionSchema.parse({id:randomUUID(),kind:'exception',seriesId:before.id,originalDate:'2026-09-20',cancelled:true});
  const records=[before,cancellation];expect(seriesImpact(before,after,records,'2026-09-18','2026-09-25')).toMatchObject({affectedHistory:[],removedCancellations:1});
  expect(seriesChanges(before,after,records,'preserve',randomUUID)).toEqual([{id:after.id,value:after},{id:cancellation.id,value:null}]);
});

it('previews new repeating meetings without changing the proposal',()=>{
  const after=item({recurrence:recurrence({frequency:'DAILY',count:3})}),copy=structuredClone(after);
  expect(seriesImpact(null,after,[],'2026-09-18','2026-09-25')).toMatchObject({beforeCount:0,afterCount:3,firstDate:'2026-09-18',lastDate:'2026-09-20',affectedHistory:[]});
  expect(after).toEqual(copy);
});

it('bounds classes to a semester and keeps manual exclusions unless replacing old break exclusions is requested',()=>{
  const old={...semester(),breaks:[{startDate:'2026-09-21',endDate:'2026-09-21'}]},next={...old,startDate:'2026-09-20',endDate:'2026-10-05',zone:'Europe/London',breaks:[{startDate:'2026-09-28',endDate:'2026-09-28'}]};
  const before=item({itemType:'class',recurrence:recurrence({frequency:'DAILY',count:5,excludedDates:['2026-09-21','2026-09-22'],extraDates:['2026-09-01','2026-09-25','2026-12-01']})});
  const after=semesterClass(before,old,next,false);
  expect(after.recurrence).toMatchObject({count:null,until:next.endDate,excludedDates:['2026-09-21','2026-09-22','2026-09-28'],extraDates:['2026-09-25']});expect(sourceDate(after.timing)).toBe(next.startDate);
  expect(after.timing.mode==='timed'&&DateTime.fromISO(after.timing.start).setZone(after.timing.zone).toFormat('HH:mm')).toBe('09:00');
  const dates=recurringDates(after,'2026-09-01','2027-01-01');expect(dates[0]).toBe(next.startDate);expect(dates.at(-1)).toBe(next.endDate);expect(dates).not.toContain('2026-09-28');
  expect(semesterClass(before,old,next,true).recurrence!.excludedDates).toEqual(['2026-09-22','2026-09-28']);
});

it.each([
  ['DAILY',3,[],'2026-09-04','2026-09-20','2026-11-01'],
  ['WEEKLY',2,[1,3,5],'2026-09-04','2026-09-08','2026-11-01'],
  ['WEEKLY',3,[],'2026-09-04','2026-08-01','2026-11-01'],
  ['MONTHLY',1,[],'2026-01-31','2026-03-01','2026-12-31'],
  ['YEARLY',1,[],'2024-02-29','2025-01-01','2032-12-31'],
] as const)('keeps %s interval phase when changing semester bounds', (frequency,interval,weekdays,start,from,to)=>{
  const before=item({timing:atDate(item().timing,start),recurrence:recurrence({frequency,interval,weekdays:[...weekdays]})});
  const old=semester(),next={...old,startDate:from,endDate:to};
  const after=semesterClass(before,old,next,false),dates=recurringDates(after,from,addDays(to,1));
  const overlapFrom=from<start?start:from;
  expect(dates.filter(d=>d>=overlapFrom)).toEqual(recurringDates(before,overlapFrom,addDays(to,1)));
  expect(dates.every(d=>d>=from&&d<=to)).toBe(true);
});

it('keeps fifth-weekday and last-weekday patterns when a semester starts earlier',()=>{
  for(const ordinal of [5,-1]){
    const before=item({timing:atDate(item().timing,'2026-05-29'),recurrence:recurrence({frequency:'MONTHLY',monthlyMode:'ordinal',ordinal,interval:2})});
    const old=semester(),next={...old,startDate:'2026-01-01',endDate:'2026-12-31'};const after=semesterClass(before,old,next,false);
    const dates=recurringDates(after,next.startDate,addDays(next.endDate,1));
    expect(dates.filter(d=>d>='2026-05-29')).toEqual(recurringDates(before,'2026-05-29','2027-01-01'));
    expect(dates.every(d=>DateTime.fromISO(d).weekday===5)).toBe(true);
  }
});

it('skips nonexistent spring clock times instead of moving the class to a different hour',()=>{
  const before=item({timing:{mode:'timed',start:'2026-03-01T07:30:00Z',end:'2026-03-01T08:30:00Z',zone:'America/Toronto'},recurrence:recurrence({weekdays:[7]})});
  const old=semester(),next={...old,startDate:'2026-03-08',endDate:'2026-03-29'};
  const after=semesterClass(before,old,next,false);expect(recurringDates(after,next.startDate,addDays(next.endDate,1))).toEqual(['2026-03-15','2026-03-22','2026-03-29']);
});

it('clips and deduplicates overlapping semester breaks',()=>{
  expect(breakDates({...semester(),breaks:[{startDate:'2026-08-29',endDate:'2026-09-02'},{startDate:'2026-09-02',endDate:'2026-09-03'}]})).toEqual(['2026-09-01','2026-09-02','2026-09-03']);
});
