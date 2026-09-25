import { addDays, expand, upcoming } from '../domain/calendar';
import { isTask, type DomainRecord, type Occurrence } from '../shared/model';
let records:DomainRecord[]=[];
let revision=0;
let upcomingKey='',upcomingValue:ReturnType<typeof upcoming>|null=null;
const ranges=new Map<string,Occurrence[]>();
const expandRange=(from:string,to:string,zone:string)=>{const key=`${revision}:${from}:${to}:${zone}`;let value=ranges.get(key);if(!value){value=expand(records,from,to,zone,50000);ranges.set(key,value);if(ranges.size>12)ranges.delete(ranges.keys().next().value!);}return value;};
self.onmessage=(event:MessageEvent)=>{
  const {id,data}=event.data;
  try{
    if(data.records){records=data.records;revision++;ranges.clear();}
    const {from,to,today,zone,now,search}=data;
    const nextUpcomingKey=`${revision}:${zone}:${Math.floor(now/30000)}`;
    if(nextUpcomingKey!==upcomingKey){upcomingValue=upcoming(records,now,zone);upcomingKey=nextUpcomingKey;}
    const noDate=records.filter(r=>r.kind==='item'&&isTask(r)&&r.timing.mode==='unscheduled').map(r=>({...r,occurrenceKey:r.id,originalDate:'',seriesId:null,startMs:null,endMs:null,date:'',endDate:''})) as Occurrence[];
    self.postMessage({id,result:{occurrences:expandRange(from,to,zone),upcoming:upcomingValue,nearTasks:expandRange(addDays(today,-30),addDays(today,181),zone).filter(isTask),noDate,search:search?expandRange(addDays(today,-365),addDays(today,366),zone).concat(noDate):[]}});
  }catch(error){self.postMessage({id,error:error instanceof Error?error.message:'The calendar could not be expanded.'});}
};
