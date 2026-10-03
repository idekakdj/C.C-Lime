import type { Occurrence } from '../shared/model';
/** Allocate lanes per connected overlap group. Intervals sharing an end/start do not overlap. */
export function weekLanes(items:Occurrence[]):Map<string,{lane:number;lanes:number}>{
  const sorted=[...items].sort((a,b)=>a.startMs!-b.startMs!||b.endMs!-a.endMs!||a.occurrenceKey.localeCompare(b.occurrenceKey));
  const result=new Map<string,{lane:number;lanes:number}>();let group:Occurrence[]=[],ends:number[]=[],groupEnd=-Infinity;
  const finish=()=>{for(const item of group)result.get(item.occurrenceKey)!.lanes=ends.length;group=[];ends=[];};
  for(const item of sorted){if(item.startMs!>=groupEnd)finish();let lane=ends.findIndex(end=>end<=item.startMs!);if(lane<0)lane=ends.length;ends[lane]=item.endMs!;group.push(item);groupEnd=Math.max(...ends);result.set(item.occurrenceKey,{lane,lanes:1});}finish();return result;
}
