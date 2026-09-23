import { parentPort } from 'node:worker_threads';
import { parseCalendar, exportCalendar } from '../domain/interchange';
parentPort?.on('message', (message: { type: string; payload: any }) => {
  try { const result=message.type==='parse'?parseCalendar(message.payload.text,message.payload.options):exportCalendar(message.payload.records,message.payload.options);parentPort?.postMessage({ok:true,result}); }
  catch(error){parentPort?.postMessage({ok:false,error:(error as Error).message});}
});
