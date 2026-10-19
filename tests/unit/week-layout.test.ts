import { expect,it } from 'vitest';
import { expand } from '../../src/domain/calendar';
import { weekLanes, weekBlock, weekScale, WEEK_HOUR_HEIGHT } from '../../src/domain/week-layout';
import { item } from '../fixtures';
it('shares lanes across connected overlaps and reuses full width after a group ends',()=>{
  const values=[[9,12],[10,11],[10,13],[13,14]].map(([start,end],i)=>item({title:`Block ${i}`,timing:{mode:'timed',start:`2026-09-18T${String(start).padStart(2,'0')}:00:00Z`,end:`2026-09-18T${String(end).padStart(2,'0')}:00:00Z`,zone:'UTC'}}));
  const result=weekLanes(expand(values,'2026-09-18','2026-09-19','UTC'));
  expect(values.slice(0,3).map(v=>result.get(v.id)?.lanes)).toEqual([3,3,3]);
  expect(new Set(values.slice(0,3).map(v=>result.get(v.id)?.lane)).size).toBe(3);
  expect(result.get(values[3].id)).toEqual({lane:0,lanes:1});
});
it('fits 24 hours without exceeding the original scale or reducing hourly labels below the readable floor',()=>{
  expect(weekScale(null,500)).toBe(37);expect(24*WEEK_HOUR_HEIGHT*weekScale(null,500)/100).toBeLessThanOrEqual(500);
  expect(weekScale(null,3000)).toBe(100);expect(weekScale(null,100)).toBe(20);
  expect(weekScale(75,500)).toBe(75);expect(weekScale(100,500)).toBe(100);
});
it('keeps early/late and cross-midnight blocks within the compressed grid and separates visual collisions',()=>{
  const values=[['00:00','00:05'],['00:10','00:15'],['23:59','00:04']].map(([start,end],i)=>item({timing:{mode:'timed',start:`2026-09-18T${start}:00Z`,end:`2026-09-${i===2?'19':'18'}T${end}:00Z`,zone:'UTC'}}));
  const items=expand(values,'2026-09-18','2026-09-19','UTC'),hour=56*.2;
  const bounds=new Map(items.map(value=>[value.occurrenceKey,weekBlock(value,'2026-09-18','UTC',hour)]));
  for(const bound of bounds.values()){expect(bound.top).toBeGreaterThanOrEqual(0);expect(bound.height).toBeGreaterThanOrEqual(26);expect(bound.top+bound.height).toBeLessThanOrEqual(24*hour);}
  expect(bounds.get(values[2].id)!.startTop).toBeGreaterThan(bounds.get(values[2].id)!.top);
  const lanes=weekLanes(items,bounds);expect(lanes.get(values[0].id)!.lanes).toBe(2);expect(lanes.get(values[1].id)!.lanes).toBe(2);expect(lanes.get(values[2].id)!.lanes).toBe(1);
});
it('uses local wall-clock hours across daylight-saving days and clips multi-day blocks to each day',()=>{
  const spring=item({timing:{mode:'timed',start:'2026-03-08T01:30:00-05:00',end:'2026-03-08T03:30:00-04:00',zone:'America/Toronto'}});
  const occurrence=expand([spring],'2026-03-08','2026-03-09','America/Toronto')[0];
  expect(weekBlock(occurrence,'2026-03-08','America/Toronto',56)).toEqual({top:84,startTop:84,height:112});
  const multi=item({timing:{mode:'timed',start:'2026-09-17T20:00:00Z',end:'2026-09-19T02:00:00Z',zone:'UTC'}});
  expect(weekBlock(expand([multi],'2026-09-18','2026-09-19','UTC')[0],'2026-09-18','UTC',56)).toEqual({top:0,startTop:0,height:1344});
});
it('rejects timed records outside the supported local calendar years',()=>{
  expect(()=>item({timing:{mode:'timed',start:'1899-12-31T14:00:00Z',end:'1899-12-31T15:00:00Z',zone:'UTC'}})).toThrow('1900');
  expect(()=>item({timing:{mode:'timed',start:'2101-01-01T05:00:00Z',end:'2101-01-01T06:00:00Z',zone:'America/Toronto'}})).toThrow('2100');
});
