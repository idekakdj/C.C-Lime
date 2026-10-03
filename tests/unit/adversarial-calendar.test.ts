import { expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { expand, recurringDates, reminderCandidates, validateTiming, localInstant } from '../../src/domain/calendar';
import { parseCalendar } from '../../src/domain/interchange';
import { item, recurrence } from '../fixtures';

it('one legacy deadline in a DST gap cannot break unrelated calendar entries',()=>{
 const gap=item({itemType:'task',timing:{mode:'deadline',date:'2026-03-08',time:'02:30',zone:'America/Toronto',anchorTime:'09:00'}});
 const valid=item({timing:{mode:'timed',start:'2026-03-08T14:00:00Z',end:'2026-03-08T15:00:00Z',zone:'America/Toronto'}});
 expect(expand([gap,valid],'2026-03-08','2026-03-09','America/Toronto').map(o=>o.id)).toEqual([valid.id]);
});
it('deadline recurrence skips nonexistent local times and counts valid occurrences consistently',()=>{
 const series=item({itemType:'task',timing:{mode:'deadline',date:'2026-03-07',time:'02:30',zone:'America/Toronto',anchorTime:'09:00'},recurrence:recurrence({frequency:'DAILY',weekdays:[],count:3})});
 expect(recurringDates(series,'2026-03-07','2026-03-12')).toEqual(['2026-03-07','2026-03-09','2026-03-10']);
 expect(expand([series],'2026-03-07','2026-03-12','America/Toronto')).toHaveLength(3);
});
it('a legacy all-day item on a skipped civil day cannot crash the whole calendar',()=>{
 const gap=item({timing:{mode:'allDay',startDate:'2011-12-30',endDate:'2011-12-31',anchorTime:'09:00',zone:'Pacific/Apia'}});
 expect(expand([gap],'2011-12-29','2012-01-02','Pacific/Apia')).toEqual([]);
});
it('conflicting duplicate occurrence overrides are rejected rather than depending on file order',()=>{
 const event=(title:string)=>`BEGIN:VEVENT\nUID:duplicate-series\nRECURRENCE-ID:20261003T130000Z\nSUMMARY:${title}\nDTSTART:20261003T140000Z\nDTEND:20261003T150000Z\nEND:VEVENT`;
 const parsed=parseCalendar(`BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nUID:duplicate-series\nSUMMARY:Original\nDTSTART:20261002T130000Z\nDTEND:20261002T140000Z\nRRULE:FREQ=DAILY;COUNT=3\nEND:VEVENT\n${event('First')}\n${event('Second')}\nEND:VCALENDAR`,{zone:'UTC'});
 expect(parsed.invalid).toBe(1);expect(parsed.records.filter(r=>r.kind==='exception')).toHaveLength(1);expect(parsed.warnings.join(' ')).toMatch(/duplicate.*occurrence/i);
});
it('a recurring legacy invalid anchor leaves later valid repetitions and unrelated reminders available',()=>{
 const series=item({timing:{mode:'deadline',date:'2026-03-08',time:'02:30',zone:'America/Toronto',anchorTime:'09:00'},recurrence:recurrence({frequency:'DAILY',weekdays:[],count:2})});
 const other=item({timing:{mode:'deadline',date:'2026-03-09',time:'12:00',zone:'America/Toronto',anchorTime:'09:00'},reminders:[{id:randomUUID(),minutesBefore:10}]});
 expect(expand([series,other],'2026-03-08','2026-03-12','America/Toronto').map(o=>o.date)).toEqual(['2026-03-09','2026-03-09','2026-03-10']);
 expect(reminderCandidates([series,other],Date.parse('2026-03-09T10:00:00Z'),'America/Toronto')).toHaveLength(1);
});
it('rejects nonexistent anchors while supporting the earlier and later fall-back offsets',()=>{
 expect(()=>validateTiming({mode:'deadline',date:'2026-03-08',time:'02:30',zone:'America/Toronto',anchorTime:'09:00'})).toThrow(/does not exist/);
 expect(localInstant('2026-11-01','01:30','America/Toronto',true).toMillis()-localInstant('2026-11-01','01:30','America/Toronto').toMillis()).toBe(3600000);
});
it('retains leap-day and month-end skip rules rather than shifting to another date',()=>{
 const leap=item({timing:{mode:'allDay',startDate:'2024-02-29',endDate:'2024-03-01',zone:'UTC',anchorTime:'09:00'},recurrence:recurrence({frequency:'YEARLY',weekdays:[],count:3})});
 expect(recurringDates(leap,'2024-01-01','2033-01-01')).toEqual(['2024-02-29','2028-02-29','2032-02-29']);
 const monthly=item({timing:{mode:'deadline',date:'2026-01-31',time:null,zone:'UTC',anchorTime:'09:00'},recurrence:recurrence({frequency:'MONTHLY',weekdays:[],count:3})});
 expect(recurringDates(monthly,'2026-01-01','2026-06-01')).toEqual(['2026-01-31','2026-03-31','2026-05-31']);
});
const overnightOverride=(identity:string)=>`BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nUID:night-series\nSUMMARY:Night study\nDTSTART;TZID=America/Toronto:20260918T233000\nDTEND;TZID=America/Toronto:20260919T003000\nRRULE:FREQ=DAILY;COUNT=3\nEND:VEVENT\nBEGIN:VEVENT\nUID:night-series\nRECURRENCE-ID:${identity}\nSUMMARY:Moved night study\nDTSTART:20260920T160000Z\nDTEND:20260920T170000Z\nEND:VEVENT\nEND:VCALENDAR`;
it('normalizes a UTC recurrence identity to its parent time zone across midnight',()=>{
 const parsed=parseCalendar(overnightOverride('20260919T033000Z'),{zone:'UTC'});
 expect(parsed.invalid).toBe(0);expect(parsed.records.find(r=>r.kind==='exception')).toMatchObject({originalDate:'2026-09-18'});
 const expanded=expand(parsed.records,'2026-09-18','2026-09-22','America/Toronto');
 expect(expanded).toHaveLength(3);expect(expanded.find(o=>o.title==='Moved night study')?.originalDate).toBe('2026-09-18');
});
it('warns instead of importing an override that targets a different time on the same date',()=>{
 const parsed=parseCalendar(overnightOverride('20260919T090000Z'),{zone:'UTC'});
 expect(parsed.invalid).toBe(1);expect(parsed.records.filter(r=>r.kind==='exception')).toHaveLength(0);expect(parsed.warnings.join(' ')).toMatch(/occurrence/);
});
it('preserves imported seconds when repeating timed events and matching their overrides',()=>{
 const text=overnightOverride('20260919T033015Z').replace('20260918T233000','20260918T233015').replace('20260919T003000','20260919T003015');
 const parsed=parseCalendar(text,{zone:'UTC'});expect(parsed.invalid).toBe(0);
 const expanded=expand(parsed.records,'2026-09-18','2026-09-22','America/Toronto');
 expect(expanded).toHaveLength(3);expect(expanded.filter(o=>o.title==='Night study').every(o=>new Date(o.startMs!).getUTCSeconds()===15)).toBe(true);
});
