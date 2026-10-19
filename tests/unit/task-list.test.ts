import { expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { expand } from '../../src/domain/calendar';
import { inTaskRange, scheduledTaskInventory, taskRangeBounds, weeklyTaskProgress } from '../../src/domain/task-list';
import type { DomainRecord, Occurrence } from '../../src/shared/model';
import { item, recurrence } from '../fixtures';

const today='2026-09-18',zone='America/Toronto';
function dated(date:string,status:'open'|'completed'='open',completedAt:string|null=null){return item({itemType:'task',timing:{mode:'deadline',date,time:null,zone,anchorTime:'09:00'},status,completedAt});}
function noDate(status:'open'|'completed'='open',completedAt:string|null=null):Occurrence{return {...item({itemType:'task',timing:{mode:'unscheduled',zone},status,completedAt}),occurrenceKey:randomUUID(),originalDate:'',seriesId:null,startMs:null,endMs:null,date:'',endDate:''};}
it('preserves completed old and far-future standalone dates independently of a calendar view',()=>{
 const values=[dated('2020-01-01','completed','2026-09-18T10:00:00Z'),dated('2030-01-01'),item({itemType:'event'})];
 const result=scheduledTaskInventory(values,today,zone);expect(result.map(r=>r.id)).toEqual([values[0].id,values[1].id]);expect(result[0].status).toBe('completed');
});
it('preserves historical repeat state and overrides while rejecting canceled/nonexistent occurrences',()=>{
 const source=item({itemType:'study',timing:{mode:'timed',start:'2026-01-01T14:00:00Z',end:'2026-01-01T15:00:00Z',zone},recurrence:recurrence({frequency:'DAILY',count:3,weekdays:[]})});
 const records:DomainRecord[]=[source,{id:randomUUID(),kind:'occurrenceState',seriesId:source.id,originalDate:'2026-01-01',status:'completed',completedAt:'2026-09-18T10:00:00Z'},
 {id:randomUUID(),kind:'exception',seriesId:source.id,originalDate:'2026-01-02',cancelled:false,override:{title:'Historic edit'}},
 {id:randomUUID(),kind:'exception',seriesId:source.id,originalDate:'2026-01-03',cancelled:true,override:{}},
 {id:randomUUID(),kind:'occurrenceState',seriesId:source.id,originalDate:'2026-02-01',status:'completed',completedAt:'2026-09-18T10:00:00Z'}];
 const result=scheduledTaskInventory(records,today,zone);expect(result.map(r=>[r.originalDate,r.status,r.title])).toEqual([['2026-01-01','completed',source.title],['2026-01-02','open','Historic edit']]);
});
it('all saved dates do not expand unrelated daily classes',()=>{
 const classes=Array.from({length:280},()=>item({itemType:'class',recurrence:recurrence({frequency:'DAILY',count:181})}));const task=dated('2030-01-01');expect(scheduledTaskInventory([...classes,task],today,zone).map(r=>r.id)).toEqual([task.id]);
});
it('uses current calendar weeks with Monday or Sunday boundaries and the current month',()=>{
 expect(taskRangeBounds(today,'week',1)).toEqual({from:'2026-09-14',to:'2026-09-21'});expect(taskRangeBounds(today,'week',7)).toEqual({from:'2026-09-13',to:'2026-09-20'});expect(taskRangeBounds(today,'month')).toEqual({from:'2026-09-01',to:'2026-10-01'});
});
it('ranges preserve undated to-dos and classify completions in the display zone',()=>{
 const old=expand([dated('2020-01-01','completed','2026-09-21T02:00:00Z')],'2019-01-01','2027-01-01',zone)[0];
 expect(inTaskRange(old,'week',today,zone,1)).toBe(true);expect(inTaskRange(old,'week',today,'UTC',1)).toBe(false);expect(inTaskRange(noDate(),'week',today,zone,1)).toBe(true);expect(inTaskRange(noDate('completed','2020-01-01T12:00Z'),'week',today,zone,1)).toBe(false);expect(inTaskRange(old,'all',today,'UTC',1)).toBe(true);
});
it('counts earlier-week scheduled work, overdue/undated completions now and open undated tasks exactly once',()=>{
 const scheduled=expand([dated('2026-09-14','completed','2026-09-15T10:00Z'),dated('2020-01-01','completed','2026-09-18T10:00Z'),dated('2026-09-20'),dated('2026-10-01')],'2019-01-01','2027-01-01',zone);
 const undated=[noDate('completed','2026-09-18T10:00Z'),noDate(),noDate('completed','2020-01-01T10:00Z')];
 expect(weeklyTaskProgress([...scheduled,...undated,...scheduled],today,zone,1)).toEqual({completed:3,total:5});
 expect(weeklyTaskProgress(scheduled.map(r=>({...r,status:'open',completedAt:null})),today,zone,1)).toEqual({completed:0,total:2});
});
