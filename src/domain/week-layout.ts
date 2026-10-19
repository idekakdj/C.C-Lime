import type { Occurrence } from '../shared/model';
import { DateTime } from 'luxon';
export const WEEK_HOUR_HEIGHT=56;
export const WEEK_MIN_SCALE=22;
export const WEEK_BLOCK_MIN_HEIGHT=26;
export function weekScale(setting:number|null,availableHeight:number):number {
  return setting===null?Math.max(WEEK_MIN_SCALE,Math.min(100,Math.floor(availableHeight/(24*WEEK_HOUR_HEIGHT)*100))):Math.max(WEEK_MIN_SCALE,Math.min(100,setting));
}
/** Wall-clock positions match the 24 displayed hour labels, including DST days. */
export function weekBlock(item:Occurrence,date:string,zone:string,hourHeight:number):{top:number;height:number;startTop:number} {
  const midnight=DateTime.fromISO(date,{zone}).startOf('day'),next=midnight.plus({days:1});
  const start=DateTime.fromMillis(Math.max(item.startMs!,midnight.toMillis()),{zone});
  const end=DateTime.fromMillis(Math.min(item.endMs!,next.toMillis()),{zone});
  const startMinute=start.hour*60+start.minute+start.second/60;
  const endMinute=end.toMillis()>=next.toMillis()?1440:end.hour*60+end.minute+end.second/60;
  const startTop=startMinute/60*hourHeight,gridHeight=24*hourHeight;
  // Keep a readable late-night block inside the grid instead of extending its scroll range.
  const top=Math.min(startTop,gridHeight-WEEK_BLOCK_MIN_HEIGHT);
  const height=Math.min(gridHeight-top,Math.max(WEEK_BLOCK_MIN_HEIGHT,(endMinute-startMinute)/60*hourHeight));
  return {top,height,startTop};
}
/** Allocate lanes per connected overlap group. Intervals sharing an end/start do not overlap. */
export function weekLanes(items:Occurrence[],bounds?:Map<string,{top:number;height:number}>):Map<string,{lane:number;lanes:number}>{
  const start=(item:Occurrence)=>bounds?.get(item.occurrenceKey)?.top??item.startMs!;
  const end=(item:Occurrence)=>{const bound=bounds?.get(item.occurrenceKey);return bound?bound.top+bound.height:item.endMs!;};
  const sorted=[...items].sort((a,b)=>start(a)-start(b)||end(b)-end(a)||a.occurrenceKey.localeCompare(b.occurrenceKey));
  const result=new Map<string,{lane:number;lanes:number}>();let group:Occurrence[]=[],ends:number[]=[],groupEnd=-Infinity;
  const finish=()=>{for(const item of group)result.get(item.occurrenceKey)!.lanes=ends.length;group=[];ends=[];};
  for(const item of sorted){if(start(item)>=groupEnd)finish();let lane=ends.findIndex(value=>value<=start(item));if(lane<0)lane=ends.length;ends[lane]=end(item);group.push(item);groupEnd=Math.max(...ends);result.set(item.occurrenceKey,{lane,lanes:1});}finish();return result;
}
