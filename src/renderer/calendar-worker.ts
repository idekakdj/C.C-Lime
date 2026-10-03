import { CalendarEngine } from './calendar-engine';
const calendar=new CalendarEngine();
self.onmessage=(event:MessageEvent)=>{
  const {id,data}=event.data;
  try{self.postMessage({id,...calendar.read(data)});}
  catch(error){self.postMessage({id,error:error instanceof Error?error.message:'The calendar could not be expanded.'});}
};
