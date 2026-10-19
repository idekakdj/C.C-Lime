import { DateTime } from 'luxon';
import { addDays, atDate, day, expand, localInstant, recurringDates, sourceDate } from './calendar';
import { itemSchema, type CalendarItem, type DomainRecord, type OccurrenceException, type OccurrenceState, type Semester, type Timing } from '../shared/model';

export type HistoryChoice = 'preserve' | 'discard';
export interface ScheduleDateChange { date:string; before:string|null; after:string|null; details:string[]; }
export interface SeriesImpact {
  id:string; title:string; beforeCount:number; afterCount:number;
  firstDate:string|null; lastDate:string|null; changes:ScheduleDateChange[];
  affectedHistory:Array<{date:string;title:string;completed:boolean}>;
  retainedHistory:number; removedCancellations:number;
}
export interface SchedulePreview {
  token:string; kind:'series'|'semester'; from:string; to:string;
  series:SeriesImpact[]; historyCount:number; warnings:string[]; restoreOldBreaks:boolean;
}
export interface RecordChange { id:string; value:DomainRecord|null; }
type History = OccurrenceException | OccurrenceState;
export function removedHistory(before:CalendarItem,after:CalendarItem,records:DomainRecord[]):History[]{
  return records.filter((r):r is History=>(r.kind==='exception'||r.kind==='occurrenceState')&&r.seriesId===before.id)
    .filter(r=>!after.recurrence||!recurringDates(after,r.originalDate,addDays(r.originalDate,1)).includes(r.originalDate));
}
function timingText(timing:Timing):string{
  if(timing.mode==='timed')return `${DateTime.fromISO(timing.start).setZone(timing.zone).toFormat('yyyy-MM-dd HH:mm')} – ${DateTime.fromISO(timing.end).setZone(timing.zone).toFormat('yyyy-MM-dd HH:mm')} (${timing.zone})`;
  if(timing.mode==='allDay')return `${timing.startDate} – ${addDays(timing.endDate,-1)} · all day`;
  if(timing.mode==='deadline')return `${timing.date}${timing.time?' '+timing.time:''} · deadline`;
  return 'No date';
}
export function seriesImpact(before:CalendarItem|null,after:CalendarItem,records:DomainRecord[],from:string,to:string):SeriesImpact{
  const children=before?records.filter((r):r is History=>(r.kind==='exception'||r.kind==='occurrenceState')&&r.seriesId===before.id):[];
  const removed=before?removedHistory(before,after,records):[];
  const removedIds=new Set(removed.map(r=>r.id));
  const oldDates=before?expand([before,...children],from,addDays(to,1),after.timing.zone):[];
  const newDates=expand([after,...children.filter(r=>!removedIds.has(r.id))],from,addDays(to,1),after.timing.zone);
  if(oldDates.length+newDates.length>20000)throw new Error('This preview exceeds 20,000 meetings. Choose a shorter preview range.');
  const prior=new Map(oldDates.map(o=>[o.originalDate,o])),next=new Map(newDates.map(o=>[o.originalDate,o]));
  const changes:ScheduleDateChange[]=[];
  for(const date of [...new Set([...prior.keys(),...next.keys()])].sort()){
    const old=prior.get(date),value=next.get(date);
    const signature=(o:typeof old)=>o?JSON.stringify([o.timing,o.title,o.location,o.notes,o.reminders,o.status]):null;
    if(signature(old)!==signature(value))changes.push({date,before:old?`${timingText(old.timing)} · ${old.title}`:null,after:value?`${timingText(value.timing)} · ${value.title}`:null,details:old&&value?(['location','notes','reminders','status']as const).filter(key=>JSON.stringify(old[key])!==JSON.stringify(value[key])):[]});
  }
  const historyDates=[...new Set(removed.filter(r=>r.kind==='occurrenceState'||!r.cancelled).map(r=>r.originalDate))].sort();
  return {id:after.id,title:after.title,beforeCount:oldDates.length,afterCount:newDates.length,firstDate:newDates[0]?.date??null,lastDate:newDates.at(-1)?.date??null,changes,
    affectedHistory:historyDates.map(date=>({date,title:children.find((r):r is OccurrenceException=>r.kind==='exception'&&r.originalDate===date)?.override.title??before!.title,completed:children.some(r=>r.kind==='occurrenceState'&&r.originalDate===date&&r.status==='completed')})),
    retainedHistory:children.length-removed.length,removedCancellations:removed.filter(r=>r.kind==='exception'&&r.cancelled).length};
}
export function seriesChanges(before:CalendarItem|null,after:CalendarItem,records:DomainRecord[],choice:HistoryChoice,newId:()=>string):RecordChange[]{
  const changes:RecordChange[]=[{id:after.id,value:after}];
  if(!before)return changes;
  const removed=removedHistory(before,after,records);
  const dates=[...new Set(removed.map(r=>r.originalDate))];
  for(const date of dates){
    const exception=removed.find((r):r is OccurrenceException=>r.kind==='exception'&&r.originalDate===date);
    const state=removed.find((r):r is OccurrenceState=>r.kind==='occurrenceState'&&r.originalDate===date);
    if(choice==='preserve'&&(state||exception&&!exception.cancelled)){
      const value=itemSchema.parse({...before,...exception?.override,id:newId(),timing:exception?.override.timing??atDate(before.timing,date),recurrence:null,sourceUid:null,...(state?{status:state.status,completedAt:state.completedAt}:{})});
      changes.push({id:value.id,value});
    }
  }
  changes.push(...removed.map(r=>({id:r.id,value:null})));
  return changes;
}
export function breakDates(semester:Semester):string[]{
  const dates=new Set<string>();
  for(const range of semester.breaks){
    for(let date=range.startDate<semester.startDate?semester.startDate:range.startDate;date<=range.endDate&&date<=semester.endDate;date=addDays(date,1)){
      dates.add(date);if(dates.size>2000)throw new Error('Semester breaks exceed 2,000 dates. Use a shorter semester or fewer breaks.');
    }
  }
  return [...dates].sort();
}
// Keep a pattern's interval phase and weekday/month-day while finding an anchor
// at or before the semester. Always subtract from the original to avoid date clamping.
function earlierAnchor(item:CalendarItem,step:number):string|null{
  const first=day(sourceDate(item.timing)!);const repeat=item.recurrence!;
  const amount=repeat.interval*step;
  const date=repeat.frequency==='DAILY'?first.minus({days:amount}):repeat.frequency==='WEEKLY'?first.minus({weeks:amount}):repeat.frequency==='MONTHLY'?first.minus({months:amount}):first.minus({years:amount});
  if(repeat.frequency==='MONTHLY'&&repeat.monthlyMode==='ordinal'){
    const start=date.startOf('month');const target=repeat.ordinal===-1?date.endOf('month').startOf('day').minus({days:(date.endOf('month').weekday-first.weekday+7)%7}):start.plus({days:(first.weekday-start.weekday+7)%7+7*(repeat.ordinal-1)});
    return target.month===date.month?target.toISODate()!:null;
  }
  if((repeat.frequency==='MONTHLY'||repeat.frequency==='YEARLY')&&date.day!==first.day)return null;
  return date.toISODate()!;
}
export function semesterClass(item:CalendarItem,oldSemester:Semester,next:Semester,restoreOldBreaks:boolean):CalendarItem{
  if(!item.recurrence||item.timing.mode!=='timed')throw new Error('Only repeating timed classes can follow a semester.');
  const original=DateTime.fromISO(item.timing.start).setZone(item.timing.zone),duration=DateTime.fromISO(item.timing.end).toMillis()-original.toMillis();
  const oldBreaks=new Set(breakDates(oldSemester));
  const excluded=[...new Set([...item.recurrence.excludedDates.filter(d=>!restoreOldBreaks||!oldBreaks.has(d)),...breakDates(next)])].sort();
  const recurrence={...item.recurrence,count:null,until:next.endDate,excludedDates:excluded,extraDates:item.recurrence.extraDates.filter(d=>d>=next.startDate&&d<=next.endDate),weekdays:item.recurrence.frequency==='WEEKLY'&&!item.recurrence.weekdays.length?[original.weekday]:item.recurrence.weekdays};
  let seed:CalendarItem|null=null;
  for(let step=0;step<100000;step++){
    const date=earlierAnchor(item,step);if(!date||date>next.startDate)continue;
    try{
      const start=localInstant(date,original.toFormat('HH:mm'),next.zone);
      seed={...item,recurrence,timing:{mode:'timed',start:start.toUTC().toISO()!,end:start.plus({milliseconds:duration}).toUTC().toISO()!,zone:next.zone}};break;
    }catch{/* Try the preceding pattern anchor if this zone has a clock gap. */}
  }
  if(!seed)throw new Error(`Cannot anchor ${item.title} in this semester.`);
  const amount=recurrence.interval*8;
  const searchEnd=day(next.startDate).plus(recurrence.frequency==='DAILY'?{days:amount}:recurrence.frequency==='WEEKLY'?{weeks:amount}:recurrence.frequency==='MONTHLY'?{months:amount}:{years:amount}).plus({days:7}).toISODate()!;
  const first=recurringDates({...seed,recurrence:{...recurrence,until:null,excludedDates:[],extraDates:[]}},next.startDate,searchEnd<'2101-01-01'?searchEnd:'2101-01-01')[0];
  if(!first)throw new Error(`${item.title} has no supported meeting date after the semester starts. Edit its repeat pattern first.`);
  return itemSchema.parse({...seed,timing:atDate(seed.timing,first)});
}
