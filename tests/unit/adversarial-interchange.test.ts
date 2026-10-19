import { expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { addDays, expand, localInstant } from '../../src/domain/calendar';
import { exportCalendar, parseCalendar, previewImport } from '../../src/domain/interchange';
import { parseRecord, type ItemType, type Timing } from '../../src/shared/model';
import { item, recurrence } from '../fixtures';

it('round trips supported combinations in a 144-case matrix and rejects unsupported class/study timing modes',()=>{
 let cases=0,rejected=0;
 for(const itemType of ['class','event','assignment','exam','study','task'] as ItemType[])
 for(const zone of ['UTC','America/Toronto','Asia/Kathmandu','Pacific/Auckland'])
 for(const date of ['2026-03-07','2026-10-31'])
 for(const mode of ['timed','allDay','deadline']){
   cases++;
   const start=localInstant(date,'23:30',zone).plus({seconds:15});
   const timing:Timing=mode==='timed'?{mode,start:start.toUTC().toISO()!,end:start.plus({minutes:90}).toUTC().toISO()!,zone}
     :mode==='allDay'?{mode,startDate:date,endDate:addDays(date,2),anchorTime:'09:00',zone}
     :{mode:'deadline',date,time:'23:30',anchorTime:'09:00',zone};
   const patch={itemType,timing,title:'<img src=x onerror=alert(1)> · résumé',notes:'Unicode 🦉, semicolon; slash\\\nSecond line',recurrence:recurrence({frequency:'DAILY',weekdays:[],count:3}),reminders:[{id:randomUUID(),minutesBefore:15}]};
   if((itemType==='class'||itemType==='study')&&mode!=='timed'){expect(()=>item(patch)).toThrow(/start and end/);rejected++;continue;}
   const value=item(patch);
   const imported=parseCalendar(exportCalendar([value],{zone}),{zone});expect(imported.invalid).toBe(0);
   const project=(records:typeof imported.records)=>expand(records,date,addDays(date,8),zone).map(o=>({title:o.title,itemType:o.itemType,date:o.date,endDate:o.endDate,startMs:o.startMs,endMs:o.endMs,notes:o.notes,status:o.status}));
   expect(project(imported.records)).toEqual(project([value]));
   expect(previewImport(parseCalendar(exportCalendar([value],{zone}),{zone}),imported.records).every(candidate=>candidate.action==='identical')).toBe(true);
 }
 expect(cases).toBe(144);expect(rejected).toBe(32);
});

it('contains a deterministic malformed-calendar corpus and never exposes invalid records to expansion',()=>{
 const event='BEGIN:VEVENT\nUID:corpus\nSUMMARY:Safe\nDTSTART:20260307T130000Z\nDTEND:20260307T140000Z\nEND:VEVENT';
 const wrap=(value:string)=>`BEGIN:VCALENDAR\nVERSION:2.0\n${value}\nEND:VCALENDAR`;
 const mutations=[
  '', '\0', 'BEGIN:VCALENDAR', 'BEGIN:VEVENT\nEND:VEVENT', '[]', '{"__proto__":{"polluted":true}}',
  ...['00000000T000000Z','20260230T130000Z','20260307T250000Z','20261301T130000Z','99999999T999999Z'].map(date=>wrap(event.replace('20260307T130000Z',date))),
  ...['FREQ=DAILY;COUNT=0','FREQ=DAILY;INTERVAL=0','FREQ=SECONDLY;COUNT=99999999','FREQ=MONTHLY;BYSETPOS=999','FREQ=UNKNOWN','FREQ=DAILY;COUNT=999999999'].map(rule=>wrap(event.replace('END:VEVENT',`RRULE:${rule}\nEND:VEVENT`))),
  wrap(event.replace('SUMMARY:Safe','SUMMARY:'+'x'.repeat(201))),wrap(event.replace('DTEND:20260307T140000Z','DTEND:20260307T120000Z')),
  wrap(event.replace('UID:corpus','UID:'+'x'.repeat(1001))),wrap(event+'\n'+event),wrap(event.replace('SUMMARY:Safe','SUMMARY:__proto__\nATTACH:file:///C:/private.txt\nURL:javascript:alert(1)')),
 ];
 for(const text of mutations){let parsed;try{parsed=parseCalendar(text,{zone:'UTC'});}catch(error){expect(error).toBeInstanceOf(Error);continue;}
  for(const record of parsed.records)expect(parseRecord(record)).toEqual(record);
  expect(()=>expand(parsed.records,'2026-03-01','2026-03-15','UTC')).not.toThrow();
 }
 expect(({} as {polluted?:boolean}).polluted).toBeUndefined();
});
