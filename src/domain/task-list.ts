import { DateTime } from 'luxon';
import { addDays, atDate, expand, sourceDate, upcoming } from './calendar';
import { isTask, type CalendarItem, type DomainRecord, type Occurrence } from '../shared/model';

export type TaskRange = 'week' | 'month' | 'all';
export function taskRangeBounds(today:string,range:'week'|'month',weekStart:1|7=1):{from:string;to:string} {
  const date=DateTime.fromISO(today);
  const from=range==='month'?date.startOf('month'):date.minus({days:(date.weekday-weekStart+7)%7});
  return {from:from.toISODate()!,to:from.plus(range==='month'?{months:1}:{days:7}).toISODate()!};
}
function completedIn(item:Occurrence,from:string,to:string,zone:string):boolean {
  if(item.status!=='completed'||!item.completedAt)return false;
  const date=DateTime.fromISO(item.completedAt).setZone(zone).toISODate();
  return !!date&&date>=from&&date<to;
}
export function inTaskRange(item:Occurrence,range:TaskRange,today:string,zone:string,weekStart:1|7):boolean {
  if(range==='all')return true;
  const {from,to}=taskRangeBounds(today,range,weekStart);
  if(!item.date&&item.status!=='completed')return true;
  return (!!item.date&&item.date<to&&item.endDate>=from)||completedIn(item,from,to,zone);
}
export function weeklyTaskProgress(items:Occurrence[],today:string,zone:string,weekStart:1|7):{completed:number;total:number} {
  const {from,to}=taskRangeBounds(today,'week',weekStart);
  const eligible=new Map(items.filter(item=>(item.date&&item.date<to&&item.endDate>=from)||(!item.date&&item.status!=='completed')||completedIn(item,from,to,zone)).map(item=>[item.occurrenceKey,item]));
  return {total:eligible.size,completed:[...eligible.values()].filter(item=>item.status==='completed').length};
}

// Include stored history and every standalone date without expanding infinite
// series across the entire supported calendar. The UI discloses the forward horizon.
export function scheduledTaskInventory(records:DomainRecord[],today:string,zone:string,overdue?:Occurrence[]):Occurrence[] {
  const masters=new Map(records.filter((r):r is CalendarItem=>r.kind==='item'&&isTask(r)&&r.timing.mode!=='unscheduled').map(item=>[item.id,item]));
  const children=new Map<string,DomainRecord[]>();
  for(const record of records)if((record.kind==='exception'||record.kind==='occurrenceState')&&masters.get(record.seriesId)?.recurrence){const list=children.get(record.seriesId)??[];list.push(record);children.set(record.seriesId,list);}
  const standalone=[...masters.values()].filter(item=>!item.recurrence);
  const recurring=[...masters.values()].filter(item=>item.recurrence);
  const related=[...children.values()].flat(),relevant=[...recurring,...related];
  const result=new Map(expand(standalone,'1900-01-01','2101-01-01',zone,50000).map(item=>[item.occurrenceKey,item]));
  const add=(items:Occurrence[])=>{for(const item of items){result.set(item.occurrenceKey,item);if(result.size>50000)throw new Error('This task list exceeds 50,000 occurrences. Shorten repeating schedules or archive older work.');}};
  add(expand(relevant,addDays(today,-30),addDays(today,181),zone,50000));
  add(overdue??upcoming(relevant,DateTime.fromISO(today,{zone}).toMillis(),zone).overdue);
  for(const master of recurring){
    const history=children.get(master.id)??[];
    const overrides=new Map(history.filter(r=>r.kind==='exception').map(r=>[r.originalDate,r]));
    const states=new Map(history.filter(r=>r.kind==='occurrenceState').map(r=>[r.originalDate,r]));
    for(const original of new Set(history.filter(r=>r.kind==='exception'||r.kind==='occurrenceState').map(r=>r.originalDate))){
      const exception=overrides.get(original);if(exception?.cancelled)continue;
      let timing;try{timing=exception?.override.timing??atDate(master.timing,original);}catch{continue;}
      const date=sourceDate(timing);if(!date)continue;
      const state=states.get(original);
      add(expand([master,...(exception?[exception]:[]),...(state?[state]:[])],addDays(date,-2),addDays(date,3),zone,50000).filter(item=>item.originalDate===original));
    }
  }
  return [...result.values()].sort((a,b)=>a.date.localeCompare(b.date)||(a.startMs??0)-(b.startMs??0)||a.title.localeCompare(b.title)||a.occurrenceKey.localeCompare(b.occurrenceKey));
}
