import { useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { day, formatTime, timingLabel } from '../domain/calendar';
import { WEEK_HOUR_HEIGHT, WEEK_MIN_SCALE, weekBlock, weekLanes, weekScale } from '../domain/week-layout';
import type { Course, Occurrence, Preferences } from '../shared/model';
import { typeColors } from './ui';

type ResizeGesture={key:string;pointer:number;y:number};
interface Props {
  dates:string[];today:string;prefs:Preferences;itemsByDate:Map<string,Occurrence[]>;courses:Map<string,Course>;
  scale:number|null;onScale:(scale:number|null)=>void;showAllDay:boolean;onShowAllDay:(show:boolean)=>void;onDate:(date:string)=>void;onOpen:(item:Occurrence)=>void;
  onMove:(item:Occurrence,date:string,minutes:number)=>void;onResize:(item:Occurrence,minutes:number)=>void;
  dragged:RefObject<Occurrence|null>;dragOffset:RefObject<number>;resizeStart:RefObject<ResizeGesture|null>;
}
export function WeekCalendar({dates,today,prefs,itemsByDate,courses,scale,onScale,showAllDay,onShowAllDay,onDate,onOpen,onMove,onResize,dragged,dragOffset,resizeStart}:Props){
  const scroll=useRef<HTMLDivElement>(null),previousHour=useRef<number|null>(null);
  const [available,setAvailable]=useState(620),[limited,setLimited]=useState(false);
  // Reserve the unchanged headers/all-day section, footer and page padding. Re-measure
  // wrapping and all-day changes as well as physical viewport resizes.
  useLayoutEffect(()=>{
    const element=scroll.current;if(!element)return;let frame=0;
    const measure=()=>{
      const area=element.closest('.calendar-area')!,layout=area.closest('.calendar-layout')!;
      const footer=area.querySelector('.calendar-footer');
      const bottom=Number.parseFloat(getComputedStyle(layout).paddingBottom)||0;
      const room=Math.floor(window.innerHeight-(element.getBoundingClientRect().top+window.scrollY)-(footer?.getBoundingClientRect().height??34)-bottom-3);
      const minimum=24*WEEK_HOUR_HEIGHT*WEEK_MIN_SCALE/100;
      const tallerRoom=Math.floor(room*1.5);
      setAvailable(Math.max(minimum,tallerRoom));setLimited(tallerRoom<minimum);
    };
    const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(measure);};
    const observer=new ResizeObserver(schedule);
    for(const node of document.querySelectorAll('.topbar,.page-heading,.verification-banner,.calendar-toolbar,.calendar-filters,.week-scale-controls,.week-date-head,.week-all-day,.calendar-footer'))observer.observe(node);
    window.addEventListener('resize',schedule);measure();
    return()=>{observer.disconnect();window.removeEventListener('resize',schedule);cancelAnimationFrame(frame);};
  },[showAllDay]);
  const percent=weekScale(scale,available),hourHeight=WEEK_HOUR_HEIGHT*percent/100;
  useLayoutEffect(()=>{
    const element=scroll.current;if(!element)return;
    element.scrollTop=scale===null?0:previousHour.current===null?7*hourHeight:element.scrollTop/previousHour.current*hourHeight;
    previousHour.current=hourHeight;
  },[hourHeight,scale]);
  return <div className="week-view" style={{'--week-hour-height':`${hourHeight}px`}as CSSProperties}>
    <div className="week-scale-controls">
      <label htmlFor="week-scale">Time-slot scale</label>
      <input id="week-scale" type="range" min={WEEK_MIN_SCALE} max="100" step="1" value={percent} aria-valuetext={`${percent}%${scale===null?', fitting available height':''}`} onChange={e=>onScale(Number(e.target.value))}/>
      <output htmlFor="week-scale">{percent}%</output>
      <button className={`button secondary ${scale===null?'selected':''}`} aria-pressed={scale===null} onClick={()=>onScale(null)}>Fit week</button>
      <button className="text-button" onClick={()=>onScale(100)}>100%</button>
      <button className="button secondary" aria-expanded={showAllDay} aria-controls="week-all-day" onClick={()=>onShowAllDay(!showAllDay)}>{showAllDay?'Hide':'Show'} all day & due</button>
      {limited&&<span className="week-fit-hint">Increase window height for a full-day fit.</span>}
    </div>
    <div className="week-date-head"><span/>{dates.map(date=><button key={date} onClick={()=>onDate(date)}><small>{day(date).toFormat('ccc')}</small><b className={date===today?'today-number':''}>{day(date).day}</b></button>)}</div>
    <div id="week-all-day" className="week-all-day" hidden={!showAllDay}><span>All day<br/>& due</span>{dates.map(date=><div key={date}>{(itemsByDate.get(date)??[]).filter(o=>o.timing.mode!=='timed').map(o=><button key={o.occurrenceKey} onClick={()=>onOpen(o)}>{o.title}</button>)}</div>)}</div>
    <div className="week-scroll" ref={scroll} style={{height:available}}>
      <div className="week-time-grid">
        <div className="time-axis">{Array.from({length:24},(_,h)=><span key={h}>{prefs.timeFormat==='24'?`${String(h).padStart(2,'0')}:00`:`${h%12||12}${h<12?'am':'pm'}`}</span>)}</div>
        {dates.map(date=>{
          const items=(itemsByDate.get(date)??[]).filter(o=>o.timing.mode==='timed');
          const bounds=new Map(items.map(o=>[o.occurrenceKey,weekBlock(o,date,prefs.zone,hourHeight)]));
          const layout=weekLanes(items,bounds);
          return <div className="week-day-track" data-week-date={date} key={date} onDragOver={e=>{if(dragged.current)e.preventDefault();}} onDrop={e=>{e.preventDefault();const item=dragged.current;dragged.current=null;if(item)onMove(item,date,(e.clientY-e.currentTarget.getBoundingClientRect().top-dragOffset.current)/hourHeight*60);}}>
            {items.map(o=>{
              const {top,height,startTop}=bounds.get(o.occurrenceKey)!,{lane,lanes}=layout.get(o.occurrenceKey)!;
              return <div key={o.occurrenceKey} className="week-block" draggable onDragStart={e=>{
                if(resizeStart.current){e.preventDefault();return;}
                dragOffset.current=e.clientY-e.currentTarget.getBoundingClientRect().top+top-startTop;
                dragged.current=o;e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',o.occurrenceKey);
              }} onDragEnd={()=>{dragged.current=null;}} style={{top,height,left:`${lane/lanes*100}%`,width:`${100/lanes}%`,'--item-color':courses.get(o.courseId??'')?.color??typeColors[o.itemType]}as CSSProperties}>
                <button title={`${o.title} · ${timingLabel(o,prefs.zone,prefs.timeFormat)}`} onClick={()=>onOpen(o)}><b>{o.title}</b><small>{formatTime(o.startMs!,prefs.zone,prefs.timeFormat)}</small></button>
                <span role="button" tabIndex={0} aria-label={`Resize ${o.title}; Enter opens time controls`} className="resize-handle" onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onOpen(o);}}} onPointerDown={e=>{e.preventDefault();e.stopPropagation();e.currentTarget.setPointerCapture(e.pointerId);resizeStart.current={key:o.occurrenceKey,pointer:e.pointerId,y:e.clientY};}} onPointerCancel={()=>{resizeStart.current=null;}} onLostPointerCapture={()=>{resizeStart.current=null;}} onPointerUp={e=>{
                  const gesture=resizeStart.current;resizeStart.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
                  if(!gesture||gesture.key!==o.occurrenceKey||gesture.pointer!==e.pointerId)return;
                  const delta=Math.round((e.clientY-gesture.y)/hourHeight*4)*15;if(delta)onResize(o,delta);
                }}/>
              </div>;
            })}
          </div>;
        })}
      </div>
    </div>
  </div>;
}
