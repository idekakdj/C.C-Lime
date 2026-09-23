import { useEffect, useRef, type ReactNode } from 'react';
import { X, CalendarDays, Check, Circle } from 'lucide-react';
import { DateTime } from 'luxon';
import { timingLabel } from '../domain/calendar';
import { isTask, type Occurrence, type Course, type Preferences } from '../shared/model';
export function Logo(){return <div className="brand"><span className="brand-mark"><CalendarDays size={23}/><i/></span><span>C.C. Lime<span className="brand-caption">STUDENT PLANNER</span></span></div>;}
export function Modal({title,subtitle,children,onClose,wide=false}:{title:string;subtitle?:string;children:ReactNode;onClose:()=>void;wide?:boolean}){
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const previous=document.activeElement as HTMLElement|null;ref.current?.showModal();return()=>{previous?.focus();};},[]);
  return <dialog ref={ref} className={`modal ${wide?'wide':''}`} onCancel={event=>{event.preventDefault();onClose();}} onClick={event=>{if(event.target===ref.current){const box=ref.current.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)onClose();}}}><header><div><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={20}/></button></header>{children}</dialog>;
}
export function Empty({title,detail,action}:{title:string;detail:string;action?:ReactNode}){return <div className="empty"><span className="empty-icon"><CalendarDays size={26}/></span><h3>{title}</h3><p>{detail}</p>{action}</div>;}
export const typeNames={class:'Class',event:'Event',assignment:'Assignment',exam:'Exam',study:'Study',task:'Task'};
export const typeColors={class:'#b9a0f5',event:'#9baee8',assignment:'#e2bc78',exam:'#ee9eb9',study:'#7bc9b4',task:'#bba3df'};
export function ItemRow({item,courses,prefs,onOpen,onComplete,compact=false,showDate=false}:{item:Occurrence;courses:Course[];prefs:Preferences;onOpen:(o:Occurrence)=>void;onComplete:(o:Occurrence)=>void;compact?:boolean;showDate?:boolean}){
  const course=courses.find(c=>c.id===item.courseId);const color=course?.color??typeColors[item.itemType];
  return <div className={`item-row ${compact?'compact':''} ${item.status==='completed'?'completed':''}`} style={{'--item-color':color} as React.CSSProperties}>
    {isTask(item)?<button className="check-button" aria-label={`${item.status==='completed'?'Reopen':'Complete'} ${item.title}`} onClick={()=>onComplete(item)}>{item.status==='completed'?<Check size={16}/>:<Circle size={17}/>}</button>:<span className="event-indicator"/>}
    <button className="item-main" onClick={()=>onOpen(item)}><span className="item-title">{item.title}{item.priority==='high'&&<span className="priority" title="High priority">!</span>}</span><span className="item-meta">{showDate&&item.date?`${DateTime.fromISO(item.date).toFormat('ccc, MMM d')} · `:''}{timingLabel(item,prefs.zone,prefs.timeFormat)}{course?` · ${course.code||course.name}`:''}{!compact&&item.location?` · ${item.location}`:''}</span></button>
    {!compact&&<span className="type-label">{typeNames[item.itemType]}</span>}
  </div>;
}
