import { expect,it } from 'vitest';
import { expand } from '../../src/domain/calendar';
import { weekLanes } from '../../src/domain/week-layout';
import { item } from '../fixtures';
it('shares lanes across connected overlaps and reuses full width after a group ends',()=>{
  const values=[[9,12],[10,11],[10,13],[13,14]].map(([start,end],i)=>item({title:`Block ${i}`,timing:{mode:'timed',start:`2026-09-18T${String(start).padStart(2,'0')}:00:00Z`,end:`2026-09-18T${String(end).padStart(2,'0')}:00:00Z`,zone:'UTC'}}));
  const result=weekLanes(expand(values,'2026-09-18','2026-09-19','UTC'));
  expect(values.slice(0,3).map(v=>result.get(v.id)?.lanes)).toEqual([3,3,3]);
  expect(new Set(values.slice(0,3).map(v=>result.get(v.id)?.lane)).size).toBe(3);
  expect(result.get(values[3].id)).toEqual({lane:0,lanes:1});
});
it('rejects timed records outside the supported local calendar years',()=>{
  expect(()=>item({timing:{mode:'timed',start:'1899-12-31T14:00:00Z',end:'1899-12-31T15:00:00Z',zone:'UTC'}})).toThrow('1900');
  expect(()=>item({timing:{mode:'timed',start:'2101-01-01T05:00:00Z',end:'2101-01-01T06:00:00Z',zone:'America/Toronto'}})).toThrow('2100');
});
