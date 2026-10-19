import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { searchCalendar } from '../../src/renderer/calendar-search';
import { CalendarEngine, type CalendarRequest } from '../../src/renderer/calendar-engine';
import { expand } from '../../src/domain/calendar';
import { courseSchema, exceptionSchema, occurrenceStateSchema, type DomainRecord } from '../../src/shared/model';
import { item, recurrence } from '../fixtures';

const from='2026-09-01',to='2026-10-01',zone='America/Toronto';
const request:CalendarRequest={from,to,today:'2026-09-18',zone,now:Date.parse('2026-09-18T12:00:00Z'),search:''};
function fixture(){
  const course=courseSchema.parse({id:randomUUID(),kind:'course',name:'Computer science',code:'CS101'});
  const series=item({title:'Quartz seminar',notes:'Required reading',location:'Library',courseId:course.id,recurrence:recurrence({frequency:'DAILY',count:5,weekdays:[]})});
  const other=item({title:'Other meeting',recurrence:recurrence({frequency:'DAILY',count:3,weekdays:[]})});
  const exception=(seriesId:string,originalDate:string,override:unknown,cancelled=false)=>exceptionSchema.parse({id:randomUUID(),kind:'exception',seriesId,originalDate,override,cancelled});
  const records:DomainRecord[]=[course,series,other,
    exception(series.id,'2026-09-19',{title:'Renamed workshop',notes:'',location:'Studio'}),
    exception(series.id,'2026-09-20',{},true),
    exception(other.id,'2026-09-18',{title:'Quartz moved',timing:{mode:'timed',start:'2026-09-26T03:00:00Z',end:'2026-09-26T04:00:00Z',zone}}),
    occurrenceStateSchema.parse({id:randomUUID(),kind:'occurrenceState',seriesId:other.id,originalDate:'2026-09-18',status:'completed',completedAt:'2026-09-27T12:00:00Z'}),
  ];return{records,series,other};
}
it.each(['quartz','renamed','required','library','computer science','CS101','reading library','no matches'])('preserves full-expansion search semantics for %s',query=>{
  const {records}=fixture(),course=records.find(r=>r.kind==='course')!;
  const expected=expand(records,from,to,zone,50000).filter(o=>`${o.title} ${o.notes} ${o.location} ${o.courseId===course.id?course.name:''} ${o.courseId===course.id?course.code:''}`.toLowerCase().includes(query.toLowerCase()));
  expect(searchCalendar(records,from,to,zone,`  ${query.toUpperCase()}  `,[])).toEqual(expected);
});
it('retains moved matching overrides, completion and display-zone boundaries while removing cancelled and renamed matches',()=>{
  const {records,series,other}=fixture(),found=searchCalendar(records,from,to,zone,'quartz',[]);
  expect(found.map(o=>o.occurrenceKey)).toEqual([`${series.id}:2026-09-18`,`${series.id}:2026-09-21`,`${series.id}:2026-09-22`,`${other.id}:2026-09-18`]);
  expect(found.at(-1)).toMatchObject({title:'Quartz moved',date:'2026-09-25',status:'completed',completedAt:'2026-09-27T12:00:00Z'});
  expect(searchCalendar(records,'2026-09-26','2026-09-27','UTC','quartz',[])).toHaveLength(1);
});
it('does not expand unrelated recurring calendars that exceed the annual search budget',()=>{
  const classes=Array.from({length:280},()=>item({title:'Unrelated class',itemType:'class',recurrence:recurrence({frequency:'DAILY',count:181,weekdays:[]})}));
  const value=item({title:'Unique quartz result'}),engine=new CalendarEngine();
  const response=engine.read({...request,from:'2026-09-18',to:'2026-09-19',records:[...classes,value],account:'a',search:'quartz'});
  expect(response.result.search?.map(o=>o.id)).toEqual([value.id]);
});
it('resends unacknowledged query results, clears empty searches and drops previous-account results',()=>{
  const engine=new CalendarEngine(),one=item({title:'Quartz'}),two=item({title:'Jasper'});
  const first=engine.read({...request,records:[one,two],account:'a',search:'quartz'});
  const second=engine.read({...request,account:'a',search:'jasper',known:first.keys});expect(Object.keys(second.result)).toEqual(['search']);expect(second.result.search?.map(o=>o.id)).toEqual([two.id]);
  const retry=engine.read({...request,account:'a',search:'jasper',known:first.keys});expect(retry.result).toEqual(second.result);
  const empty=engine.read({...request,account:'a',search:'',known:second.keys});expect(empty.result.search).toEqual([]);
  const switched=engine.read({...request,account:'b',records:[],search:'quartz',known:first.keys});expect(switched.result.search).toEqual([]);
});
it('keeps matching no-date tasks after scheduled results and invalidates searches when records change',()=>{
  const engine=new CalendarEngine(),scheduled=item({title:'Quartz'}),task=item({title:'Quartz task',itemType:'task',timing:{mode:'unscheduled',zone}});
  const first=engine.read({...request,records:[task,scheduled],account:'a',search:'quartz'});expect(first.result.search?.map(o=>o.id)).toEqual([scheduled.id,task.id]);
  const updated=engine.read({...request,records:[{...task,title:'Jasper task'},scheduled],account:'a',search:'quartz',known:first.keys});expect(updated.result.search?.map(o=>o.id)).toEqual([scheduled.id]);
});
