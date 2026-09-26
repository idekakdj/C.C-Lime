import { expect,it } from 'vitest';
import { item,recurrence } from '../fixtures';
import { expand,sourceDate } from '../../src/domain/calendar';
import { moveDate,moveTime,resizeTime,moveSeries } from '../../src/domain/movement';
const occurrence=(value=item())=>expand([value],'2026-01-01','2027-01-01','America/Toronto')[0];
it('snaps week movement in the display zone while retaining elapsed duration and original zone',()=>{
  const original=occurrence();const moved=moveTime(original,'2026-09-21',10*60+8,'Europe/London');
  expect(moved).toEqual({mode:'timed',start:'2026-09-21T09:15:00.000Z',end:'2026-09-21T10:15:00.000Z',zone:'America/Toronto'});
  expect(moveTime(original,'2026-09-21',-50,'UTC')).toMatchObject({start:'2026-09-21T00:00:00.000Z'});
  expect(moveTime(original,'2026-09-21',1500,'UTC')).toMatchObject({start:'2026-09-21T23:45:00.000Z'});
});
it('rejects a dropped clock-gap time and a resize to zero or negative duration',()=>{
  const original=occurrence();expect(()=>moveTime(original,'2026-03-08',150,'America/Toronto')).toThrow('does not exist');
  expect(()=>resizeTime(original,-60)).toThrow();expect(resizeTime(original,22)).toMatchObject({end:'2026-09-18T14:15:00.000Z'});
});
it('moves month dates across DST while retaining the source wall time and duration',()=>{
  const original=occurrence();expect(moveDate(original,'2026-11-05')).toMatchObject({start:'2026-11-05T14:00:00.000Z',end:'2026-11-05T15:00:00.000Z'});
});
it('applies an occurrence move to the series wall time and weekdays without moving its end bound or history',()=>{
  const master=item({recurrence:recurrence({weekdays:[1,5],until:'2026-12-20',excludedDates:['2026-10-12']})});const original=occurrence(master);
  const result=moveSeries(master,original,moveTime(original,'2026-09-20',600,'America/Toronto'),'move');
  expect(sourceDate(result.timing)).toBe('2026-09-20');expect(result.timing).toMatchObject({start:'2026-09-20T14:00:00.000Z',end:'2026-09-20T15:00:00.000Z'});expect(result.recurrence).toMatchObject({weekdays:[3,7],until:'2026-12-20',excludedDates:['2026-10-12']});
});
it('applies a resize delta to the whole series and keeps the anchor fixed',()=>{
  const master=item({recurrence:recurrence({count:4})}),original=occurrence(master),result=moveSeries(master,original,resizeTime(original,30),'resize');
  expect(result.timing).toMatchObject({start:'2026-09-18T13:00:00.000Z',end:'2026-09-18T14:30:00.000Z'});expect(result.recurrence).toEqual(master.recurrence);
});
it('preserves all-day spans and moves deadline dates without inventing durations',()=>{
  const allDay=occurrence(item({timing:{mode:'allDay',startDate:'2026-09-18',endDate:'2026-09-21',zone:'America/Toronto',anchorTime:'09:00'}}));expect(moveDate(allDay,'2026-09-22')).toMatchObject({startDate:'2026-09-22',endDate:'2026-09-25'});
  const due=occurrence(item({itemType:'task',timing:{mode:'deadline',date:'2026-09-18',time:null,zone:'America/Toronto',anchorTime:'09:00'}}));expect(moveDate(due,'2026-09-23')).toMatchObject({date:'2026-09-23',time:null});expect(()=>resizeTime(due,15)).toThrow('Only time blocks');
});
