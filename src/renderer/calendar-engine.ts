import { addDays, expand, upcoming } from '../domain/calendar';
import { isTask, type DomainRecord, type Occurrence } from '../shared/model';

export interface CalendarResult {
  occurrences:Occurrence[]; upcoming:ReturnType<typeof upcoming>; nearTasks:Occurrence[]; noDate:Occurrence[]; search:Occurrence[];
}
export interface CalendarRequest {from:string;to:string;today:string;zone:string;now:number;search:boolean;}
export type CalendarKeys = Partial<Record<keyof CalendarResult,string>>;
export interface CalendarReply {keys:CalendarKeys;result:Partial<CalendarResult>;}
export const emptyCalendar:CalendarResult={occurrences:[],upcoming:{upcoming:[],overdue:[],nextEvent:null},nearTasks:[],noDate:[],search:[]};

// Keys describe data the renderer has actually received, not the worker's last
// response. A superseded request therefore cannot leave the renderer with holes.
export class CalendarEngine {
  private records:DomainRecord[]=[];
  private account:string|null|undefined;
  private revision=0;
  private ranges=new Map<string,Occurrence[]>();
  private values:Partial<CalendarResult>={};
  private keys:CalendarKeys={};
  private expand(from:string,to:string,zone:string):Occurrence[]{
    const key=JSON.stringify([from,to,zone]);let value=this.ranges.get(key);
    if(!value){value=expand(this.records,from,to,zone,50000);this.ranges.set(key,value);if(this.ranges.size>12)this.ranges.delete(this.ranges.keys().next().value!);}
    return value;
  }
  read(request:CalendarRequest&{account:string|null;records?:DomainRecord[];known?:CalendarKeys}):CalendarReply{
    const {account,records,from,to,today,zone,now,search,known={}}=request;
    if(account!==this.account&&records===undefined)throw new Error('Calendar data must be reloaded after switching accounts.');
    if(records!==undefined){this.account=account;this.records=records;this.revision++;this.ranges.clear();this.values={};this.keys={};}
    const base=[this.revision,zone],reply:CalendarReply={keys:{},result:{}};
    const part=<K extends keyof CalendarResult>(name:K,parts:unknown[],create:()=>CalendarResult[K])=>{
      const key=JSON.stringify(parts);if(this.keys[name]!==key){this.values[name]=create();this.keys[name]=key;}
      reply.keys[name]=key;if(known[name]!==key)reply.result[name]=this.values[name]!;
    };
    part('occurrences',[...base,from,to],()=>this.expand(from,to,zone));
    part('upcoming',[...base,Math.floor(now/30000)],()=>upcoming(this.records,now,zone));
    part('noDate',[this.revision],()=>this.records.filter(r=>r.kind==='item'&&isTask(r)&&r.timing.mode==='unscheduled').map(r=>({...r,occurrenceKey:r.id,originalDate:'',seriesId:null,startMs:null,endMs:null,date:'',endDate:''}))as Occurrence[]);
    // A six-month task list must not expand unrelated daily classes or events.
    // Keep occurrence overrides and completion records for the selected masters.
    part('nearTasks',[...base,today],()=>expand(this.records.filter(r=>r.kind!=='item'||isTask(r)),addDays(today,-30),addDays(today,181),zone,50000));
    part('search',[...base,today,search],()=>search?this.expand(addDays(today,-365),addDays(today,366),zone).concat(this.values.noDate!):[]);
    return reply;
  }
}

// Precompute the short view window once. No date parsing is needed per item,
// including long all-day spans and events crossing midnight or a month edge.
export function indexDays(items:Occurrence[],from:string,to:string):Map<string,Occurrence[]>{
  const dates:string[]=[];for(let date=from;date<to;date=addDays(date,1))dates.push(date);
  const positions=new Map(dates.map((date,index)=>[date,index]));
  const result=new Map(dates.map(date=>[date,[]as Occurrence[]]));
  for(const item of items){
    if(!item.date||item.date>=to||item.endDate<from)continue;
    const start=positions.get(item.date<from?from:item.date)!,end=positions.get(item.endDate>=to?dates.at(-1)!:item.endDate)!;
    for(let index=start;index<=end;index++)result.get(dates[index])!.push(item);
  }
  return result;
}
