import { useEffect, useRef, useState } from 'react';
import type { DomainRecord, Occurrence } from '../shared/model';
export interface CalendarResult {occurrences:Occurrence[];upcoming:{upcoming:Occurrence[];overdue:Occurrence[];nextEvent:Occurrence|null};nearTasks:Occurrence[];noDate:Occurrence[];search:Occurrence[];}
const empty:CalendarResult={occurrences:[],upcoming:{upcoming:[],overdue:[],nextEvent:null},nearTasks:[],noDate:[],search:[]};
export function useCalendar(records:DomainRecord[],account:string|null,request:{from:string;to:string;today:string;zone:string;now:number;search:boolean}){
  const worker=useRef<Worker|null>(null),sequence=useRef(0),sentRecords=useRef<DomainRecord[]|null>(null);
  const signature=JSON.stringify(request);
  const [state,setState]=useState<{account:string|null;result:CalendarResult;error:string;signature:string;records:DomainRecord[]|null}>({account:null,result:empty,error:'',signature:'',records:null});
  useEffect(()=>{const current=new Worker(new URL('./calendar-worker.ts',import.meta.url),{type:'module'});worker.current=current;sentRecords.current=null;return()=>{current.terminate();worker.current=null;};},[]);
  useEffect(()=>{
    const current=worker.current;if(!current)return;const id=++sequence.current;
    current.onmessage=event=>{if(event.data.id!==sequence.current)return;setState({account,result:event.data.result??empty,error:event.data.error??'',signature,records});};
    current.onerror=()=>{if(id===sequence.current)setState({account,result:empty,error:'Calendar processing stopped. Reopen the app to try again.',signature,records});};
    current.postMessage({id,data:{...request,...(sentRecords.current!==records?{records}:{})}});sentRecords.current=records;
  },[records,account,request.from,request.to,request.today,request.zone,request.now,request.search]);
  const pending=state.account!==account||state.signature!==signature||state.records!==records;
  return state.account===account?{...state,pending}:{account,result:empty,error:'',pending};
}
