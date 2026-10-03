import { useEffect, useRef, useState } from 'react';
import type { DomainRecord } from '../shared/model';
import { emptyCalendar as empty, type CalendarResult, type CalendarRequest, type CalendarKeys } from './calendar-engine';
export function useCalendar(records:DomainRecord[],account:string|null,request:CalendarRequest){
  const worker=useRef<Worker|null>(null),sequence=useRef(0),sentRecords=useRef<DomainRecord[]|null>(null),sentAccount=useRef<string|null|undefined>(undefined);
  const received=useRef<{account:string|null;result:CalendarResult;keys:CalendarKeys}>({account:null,result:empty,keys:{}});
  const signature=JSON.stringify(request);
  const [state,setState]=useState<{account:string|null;result:CalendarResult;error:string;signature:string;records:DomainRecord[]|null}>({account:null,result:empty,error:'',signature:'',records:null});
  useEffect(()=>{const current=new Worker(new URL('./calendar-worker.ts',import.meta.url),{type:'module'});worker.current=current;sentRecords.current=null;received.current={account:null,result:empty,keys:{}};return()=>{current.terminate();worker.current=null;};},[]);
  useEffect(()=>{
    const current=worker.current;if(!current)return;const id=++sequence.current;
    current.onmessage=event=>{if(event.data.id!==sequence.current)return;
      const base=received.current.account===account?received.current.result:empty;
      const result=event.data.error?empty:{...base,...event.data.result};
      received.current={account,result,keys:event.data.error?{}:event.data.keys};
      setState({account,result,error:event.data.error??'',signature,records});
    };
    current.onerror=()=>{if(id===sequence.current)setState({account,result:empty,error:'Calendar processing stopped. Reopen the app to try again.',signature,records});};
    current.postMessage({id,data:{...request,account,known:received.current.account===account?received.current.keys:{},...(sentRecords.current!==records||sentAccount.current!==account?{records}:{})}});sentRecords.current=records;sentAccount.current=account;
  },[records,account,request.from,request.to,request.today,request.zone,request.now,request.search]);
  const pending=state.account!==account||state.signature!==signature||state.records!==records;
  return state.account===account?{...state,pending}:{account,result:empty,error:'',pending};
}
