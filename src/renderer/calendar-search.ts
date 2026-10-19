import { expand } from '../domain/calendar';
import { type CalendarItem, type Course, type DomainRecord, type Occurrence } from '../shared/model';

export function matchesSearch(item:CalendarItem,course:Course|undefined,query:string):boolean{
  return `${item.title} ${item.notes} ${item.location} ${course?.name??''} ${course?.code??''}`.toLowerCase().includes(query);
}

// Select possible masters before recurrence expansion. An override may introduce
// a match or remove one, so inspect effective text and filter expanded results too.
export function searchCalendar(records:DomainRecord[],from:string,to:string,zone:string,query:string,noDate:Occurrence[]):Occurrence[]{
  const text=query.trim().toLowerCase();if(!text)return [];
  const courses=new Map(records.filter((r):r is Course=>r.kind==='course').map(r=>[r.id,r]));
  const masters=new Map(records.filter((r):r is CalendarItem=>r.kind==='item').map(r=>[r.id,r]));
  const matches=(item:CalendarItem)=>matchesSearch(item,item.courseId?courses.get(item.courseId):undefined,text);
  const selected=new Set([...masters.values()].filter(matches).map(item=>item.id));
  for(const record of records){
    if(record.kind!=='exception'||record.cancelled)continue;
    const master=masters.get(record.seriesId);
    if(master&&matches({...master,...record.override}))selected.add(master.id);
  }
  const relevant=records.filter(r=>r.kind==='item'?selected.has(r.id):(r.kind==='exception'||r.kind==='occurrenceState')&&selected.has(r.seriesId));
  return expand(relevant,from,to,zone,50000).filter(matches).concat(noDate.filter(matches));
}
