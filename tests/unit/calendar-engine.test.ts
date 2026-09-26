import { expect, it } from 'vitest';
import { CalendarEngine, indexDays, type CalendarRequest, emptyCalendar } from '../../src/renderer/calendar-engine';
import { expand } from '../../src/domain/calendar';
import { mergeSnapshot } from '../../src/renderer/snapshot-state';
import { defaultDeviceSettings, type Snapshot } from '../../src/shared/model';
import { item, recurrence } from '../fixtures';

const request:CalendarRequest={from:'2026-09-01',to:'2026-10-01',today:'2026-09-18',zone:'America/Toronto',now:Date.parse('2026-09-18T12:00:00Z'),search:false};
it('transfers only changed view data and resends results the renderer has not acknowledged',()=>{
  const engine=new CalendarEngine(),value=item({recurrence:recurrence({frequency:'DAILY',count:50})});
  const first=engine.read({...request,account:'student',records:[value]});expect(Object.keys(first.result)).toHaveLength(5);
  const second=engine.read({...request,account:'student',from:'2026-10-01',to:'2026-11-01',known:first.keys});expect(Object.keys(second.result)).toEqual(['occurrences']);
  // The October result was superseded before it arrived. A subsequent October
  // request with the last accepted September keys must still receive its items.
  const retried=engine.read({...request,account:'student',from:'2026-10-01',to:'2026-11-01',known:first.keys});expect(retried.result.occurrences).toEqual(second.result.occurrences);
  expect(engine.read({...request,account:'student',from:'2026-10-01',to:'2026-11-01',known:second.keys}).result).toEqual({});
});
it('invalidates search, date-only tasks and sidebar results after edits, clock ticks and zone changes',()=>{
  const engine=new CalendarEngine(),value=item({itemType:'task',timing:{mode:'unscheduled',zone:'America/Toronto'}});
  const first=engine.read({...request,account:'student',records:[value],search:true});expect(first.result.noDate).toHaveLength(1);expect(first.result.search).toHaveLength(1);
  const updated=engine.read({...request,account:'student',records:[{...value,title:'Edited',status:'completed'}],search:true,known:first.keys});expect(updated.result.search?.[0]).toMatchObject({title:'Edited',status:'completed'});
  const tick=engine.read({...request,account:'student',now:request.now+30000,search:true,known:updated.keys});expect(Object.keys(tick.result)).toEqual(['upcoming']);
  const zone=engine.read({...request,account:'student',zone:'Pacific/Honolulu',search:true,known:tick.keys});expect(zone.result.search?.[0].title).toBe('Edited');expect(zone.result.nearTasks).toBeDefined();
  const midnight=engine.read({...request,account:'student',today:'2026-09-19',search:false,known:updated.keys});expect(midnight.result.nearTasks).toBeDefined();expect(midnight.result.search).toEqual([]);
});
it('never reuses another account’s worker results even when its acknowledged keys are supplied',()=>{
  const engine=new CalendarEngine(),first=engine.read({...request,account:'first',records:[item()]});
  expect(()=>engine.read({...request,account:'second',known:first.keys})).toThrow('switching accounts');
  const second=engine.read({...request,account:'second',records:[],known:first.keys});expect(second.result).toEqual(emptyCalendar);
  const signedOut=engine.read({...request,account:null,records:[],known:second.keys});expect(signedOut.result).toEqual(emptyCalendar);
});
it('opens a valid week even when unrelated classes would overflow the six-month task window',()=>{
  const classes=Array.from({length:280},()=>item({itemType:'class',recurrence:recurrence({frequency:'DAILY',count:181})}));
  const task=item({itemType:'task',title:'Only relevant task'}),engine=new CalendarEngine();
  const result=engine.read({...request,from:'2026-09-18',to:'2026-09-19',account:'student',records:[...classes,task]}).result;
  expect(result.occurrences).toHaveLength(281);expect(result.nearTasks?.map(o=>o.title)).toEqual(['Only relevant task']);
});
it('indexes inclusive displayed spans at month edges while preserving source ordering',()=>{
  const values=[item({timing:{mode:'allDay',startDate:'2026-08-29',endDate:'2026-10-03',zone:'America/Toronto',anchorTime:'09:00'}}),item({timing:{mode:'timed',start:'2026-09-02T03:00:00Z',end:'2026-09-02T05:00:00Z',zone:'America/Toronto'}}),item({timing:{mode:'allDay',startDate:'2026-09-02',endDate:'2026-09-03',zone:'America/Toronto',anchorTime:'09:00'}})];
  const occurrences=expand(values,'2026-09-01','2026-09-04','America/Toronto'),index=indexDays(occurrences,'2026-09-01','2026-09-04');
  expect([...index.keys()]).toEqual(['2026-09-01','2026-09-02','2026-09-03']);
  for(const [date,items]of index)expect(items).toEqual(occurrences.filter(o=>o.date<=date&&o.endDate>=date));
  expect(index.get('2026-09-03')).toHaveLength(1);expect(indexDays([],request.from,request.from).size).toBe(0);
});
it('merges acknowledged snapshots only for the same account and exact store revision',()=>{
  const first:Snapshot={records:[item()],recordsRevision:'store:1',session:null,device:defaultDeviceSettings,sync:{state:'local',pending:0,lastSynced:null,message:''},conflicts:[],reminders:[],configured:false,googleConfigured:false,version:'test',localMode:true};
  const {records,...update}=first;expect(mergeSnapshot(first,{...update,device:{...first.device,view:'week'}}).records).toBe(records);
  expect(()=>mergeSnapshot(null,update)).toThrow('reloaded');expect(()=>mergeSnapshot(first,{...update,recordsRevision:'store:2'})).toThrow('reloaded');expect(()=>mergeSnapshot(first,{...update,localMode:false})).toThrow('reloaded');
  expect(mergeSnapshot(first,{...update,recordsRevision:undefined,records:[],localMode:false}).records).toEqual([]);
});
