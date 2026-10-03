import { DateTime } from 'luxon';
import { addDays, atDate, day, localInstant, sourceDate } from './calendar';
import { itemSchema, timingSchema, type CalendarItem, type Occurrence, type Timing } from '../shared/model';

export function moveDate(item:Occurrence,target:string):Timing{
  const first=sourceDate(item.timing);if(!first)throw new Error('Add a date before moving this item.');
  const delta=day(target).diff(day(item.date),'days').days;
  return timingSchema.parse(atDate(item.timing,addDays(first,delta)));
}
export function moveTime(item:Occurrence,target:string,minutes:number,displayZone:string):Timing{
  if(item.timing.mode!=='timed')throw new Error('Only time blocks can move in the hourly grid.');
  const snapped=Math.max(0,Math.min(1425,Math.round(minutes/15)*15));
  const start=localInstant(target,`${String(Math.floor(snapped/60)).padStart(2,'0')}:${String(snapped%60).padStart(2,'0')}`,displayZone);
  return timingSchema.parse({...item.timing,start:start.toUTC().toISO()!,end:start.plus({milliseconds:item.endMs!-item.startMs!}).toUTC().toISO()!});
}
export function resizeTime(item:Occurrence,minutes:number):Timing{
  if(item.timing.mode!=='timed')throw new Error('Only time blocks can be resized.');
  return timingSchema.parse({...item.timing,end:DateTime.fromISO(item.timing.end).plus({minutes:Math.round(minutes/15)*15}).toUTC().toISO()!});
}
// Apply the reviewed occurrence's wall-clock displacement (or duration change)
// to the master. Absolute exclusions/overrides remain for the impact review.
export function moveSeries(master:CalendarItem,original:Occurrence,proposed:Timing,kind:'move'|'resize'):CalendarItem{
  if(!master.recurrence)throw new Error('This series is no longer available.');
  let timing:Timing;
  if(master.timing.mode==='timed'&&original.timing.mode==='timed'&&proposed.mode==='timed'){
    const zone=master.timing.zone,base=DateTime.fromISO(master.timing.start).setZone(zone);
    const old=DateTime.fromISO(original.timing.start).setZone(zone),next=DateTime.fromISO(proposed.start).setZone(zone);
    const wall=(value:DateTime)=>DateTime.fromFormat(value.toFormat('yyyy-MM-dd HH:mm'),'yyyy-MM-dd HH:mm',{zone:'UTC'});
    const moved=wall(base).plus({milliseconds:wall(next).toMillis()-wall(old).toMillis()});
    const start=kind==='resize'?base:localInstant(moved.toISODate()!,moved.toFormat('HH:mm'),zone);
    const duration=DateTime.fromISO(master.timing.end).toMillis()-base.toMillis();
    const delta=kind==='resize'?(DateTime.fromISO(proposed.end).toMillis()-next.toMillis())-(DateTime.fromISO(original.timing.end).toMillis()-old.toMillis()):0;
    timing={...master.timing,start:start.toUTC().toISO()!,end:start.plus({milliseconds:duration+delta}).toUTC().toISO()!};
  }else if(master.timing.mode==='allDay'&&original.timing.mode==='allDay'&&proposed.mode==='allDay'&&kind==='move'){
    timing=atDate(master.timing,addDays(master.timing.startDate,day(proposed.startDate).diff(day(original.timing.startDate),'days').days));
  }else throw new Error('Use the series editor to change this timing pattern.');
  const dateDelta=day(sourceDate(timing)!).diff(day(sourceDate(master.timing)!), 'days').days;
  const recurrence={...master.recurrence,weekdays:master.recurrence.weekdays.map(value=>((value-1+dateDelta)%7+7)%7+1)};
  return itemSchema.parse({...master,timing,recurrence});
}
