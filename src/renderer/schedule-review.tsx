import { useState } from 'react';
import type { HistoryChoice, SchedulePreview, SeriesImpact } from '../domain/schedule-changes';
import { Modal } from './ui';
type Run=(command:string,payload?:unknown,message?:string)=>Promise<any>;
export function ScheduleReview({preview,run,onClose,onSaved,reload}:{preview:SchedulePreview;run:Run;onClose:()=>void;onSaved:()=>void;reload:(from:string,to:string,restore:boolean)=>Promise<void>}){
  const [from,setFrom]=useState(preview.from),[to,setTo]=useState(preview.to),[history,setHistory]=useState<HistoryChoice>('preserve');
  const [discardConfirmed,setDiscardConfirmed]=useState(false),[busy,setBusy]=useState(false);
  const rangeChanged=from!==preview.from||to!==preview.to;
  async function refresh(restore=preview.restoreOldBreaks){setBusy(true);try{await reload(from,to,restore);setDiscardConfirmed(false);}finally{setBusy(false);}}
  async function apply(applyTimetable=true){setBusy(true);try{if(await run('schedule.commit',{token:preview.token,history,applyTimetable},preview.kind==='semester'?'Semester changes saved':'Schedule saved'))onSaved();}finally{setBusy(false);}}
  const canApply=!busy&&!rangeChanged&&(history==='preserve'||!preview.historyCount||discardConfirmed);
  return <Modal title={preview.kind==='semester'?'Review semester timetable changes':'Review repeating schedule'} subtitle="Nothing changes until you apply this preview." onClose={()=>{if(!busy){void run('schedule.cancel');onClose();}}} wide>
    <div className="editor">
      <div className="form-grid"><label>Preview first date<input type="date" min="1900-01-01" max="2100-12-31" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>Preview last date<input type="date" min={from} max="2100-12-31" value={to} onChange={e=>setTo(e.target.value)}/></label></div>
      <button className="button secondary" disabled={busy||!from||!to||to<from} onClick={()=>refresh()}>Update preview</button>
      <p className="field-help">Meeting counts and dates below cover {preview.from} through {preview.to}. Applying a change updates the entire series, including dates outside this window. Existing occurrence overrides stay attached wherever their original dates still exist.</p>
      {preview.warnings.map(warning=><p className="field-help" key={warning}>{warning}</p>)}
      {preview.kind==='semester'&&<label className="checkbox-label"><input type="checkbox" checked={preview.restoreOldBreaks} disabled={busy||rangeChanged} onChange={e=>refresh(e.target.checked)}/> Replace exclusions from previous semester breaks</label>}
      <div className="schedule-preview-list">{preview.series.length?preview.series.map(series=><Impact key={`${preview.token}:${series.id}`} value={series}/>):<p>No repeating classes are linked to this semester.</p>}</div>
      {preview.historyCount>0&&<fieldset><legend>Keep the history of {preview.historyCount} removed occurrences</legend><p>The new pattern no longer includes these edited or completed dates. This choice covers all affected history, including dates outside the preview window.</p><label>When applying the new schedule<select value={history} onChange={e=>{setHistory(e.target.value as HistoryChoice);setDiscardConfirmed(false);}}><option value="preserve">Keep them as separate calendar items</option><option value="discard">Discard their edits and completion history</option></select></label>{history==='discard'&&<label className="checkbox-label"><input type="checkbox" checked={discardConfirmed} onChange={e=>setDiscardConfirmed(e.target.checked)}/> I understand that applying this change discards the listed occurrence history.</label>}</fieldset>}
      <footer className="modal-actions"><button className="button secondary" disabled={busy} onClick={()=>{void run('schedule.cancel');onClose();}}>Back to editing</button><div>{preview.kind==='semester'&&<button className="button secondary" disabled={busy||rangeChanged} onClick={()=>apply(false)}>Save semester only</button>}<button className="button primary" disabled={!canApply} onClick={()=>apply()}>{busy?'One moment…':preview.kind==='semester'?'Apply timetable changes':'Apply schedule'}</button></div></footer>
    </div>
  </Modal>;
}
function Impact({value}:{value:SeriesImpact}){
  const [shown,setShown]=useState(50),[historyShown,setHistoryShown]=useState(50);
  const added=value.changes.filter(c=>!c.before).length,removed=value.changes.filter(c=>!c.after).length;
  return <section className="schedule-impact"><h3>{value.title}</h3><p>{value.beforeCount} → {value.afterCount} meetings in this date range · {added} added · {removed} removed · {value.changes.length-added-removed} changed</p>{value.firstDate&&<p className="field-help">New date span in this preview: {value.firstDate} – {value.lastDate}</p>}
    {value.retainedHistory>0&&<p>{value.retainedHistory} occurrence edits or completion records remain attached.</p>}
    {value.removedCancellations>0&&<p className="field-help">{value.removedCancellations} cancellations no longer match the new pattern and will be removed. Canceled dates without other history do not become separate items.</p>}
    <ol className="schedule-changes" tabIndex={0} aria-label={`Date changes for ${value.title}`}>{value.changes.slice(0,shown).map(change=><li key={change.date}><b>{change.date}</b><span>{change.before?`Before: ${change.before}`:'New meeting'}</span><span>{change.after?`After: ${change.after}`:'Removed from this series'}</span>{change.details.length>0&&<span>Also changed: {change.details.join(', ')}</span>}</li>)}</ol>
    {shown<value.changes.length&&<button className="text-button" onClick={()=>setShown(v=>v+50)}>Show {Math.min(50,value.changes.length-shown)} more date changes</button>}
    {value.affectedHistory.length>0&&<><h4>History needing your choice</h4><ul>{value.affectedHistory.slice(0,historyShown).map(h=><li key={h.date}>{h.date} · {h.title}{h.completed?' · completed':''}</li>)}</ul>{historyShown<value.affectedHistory.length&&<button className="text-button" onClick={()=>setHistoryShown(v=>v+50)}>Show more affected history</button>}</>}
  </section>;
}
