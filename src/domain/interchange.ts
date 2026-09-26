import ICAL from 'ical.js';
import { DateTime, IANAZone } from 'luxon';
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { itemSchema, parseRecord, recurrenceSchema, localDate, zone as zoneSchema, type CalendarItem, type DomainRecord, type ImportCandidate, type Recurrence, type Timing } from '../shared/model';
import { addDays, atDate, expand, localInstant, recurrenceRule, sourceDate } from './calendar';

const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
function stableId(source: string): string { const h=createHash('sha256').update(source).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`; }
export interface ParseOptions { zone: string; finiteRange?: { from: string; to: string }; }
export interface ParsedCalendar { records: DomainRecord[]; warnings: string[]; invalid: number; }
function readTime(property: ICAL.Property | null, floatingZone: string, custom = false): { date: string; instant: string; zone: string; allDay: boolean } {
  if (!property) throw new Error('Missing calendar date.');
  const value = property.getFirstValue() as ICAL.Time;
  if (!value || typeof value.toString !== 'function') throw new Error('Invalid calendar date.');
  const text=value.toString(); const tzid=property.getParameter('tzid') as string | undefined;
  let zone=tzid ?? (value.zone?.tzid === 'UTC' ? 'UTC' : floatingZone);
  if (zone !== 'UTC' && !IANAZone.isValidZone(zone)) {
    if (!custom || !tzid || !ICAL.TimezoneService.has(tzid)) throw new Error(`Custom time zone “${zone}” needs finite-range conversion.`);
    const instant=DateTime.fromMillis(value.toUnixTime()*1000,{zone:'UTC'});return {date:instant.toISODate()!,instant:instant.toISO()!,zone:'UTC',allDay:value.isDate};
  }
  const date=localDate.parse(text.slice(0,10));
  const instant=localInstant(date,value.isDate?'09:00':text.slice(11,16),zone).plus({seconds:value.isDate?0:value.second});
  return { date, instant:instant.toUTC().toISO()!, zone, allDay:value.isDate };
}
function nativeRecurrence(component: ICAL.Component, first: string, timing:Timing): Recurrence | null {
  const rules=component.getAllProperties('rrule'); if (!rules.length) {if(component.hasProperty('rdate'))throw new Error('Additional dates without a recurrence rule need finite-range conversion.');return null;} if(rules.length>1) throw new Error('Multiple recurrence rules need finite-range conversion.');
  const tzid=component.getFirstProperty('dtstart')?.getParameter('tzid') as string|undefined;
  if(tzid&&tzid!=='UTC'&&!IANAZone.isValidZone(tzid))throw new Error('Custom time zone recurrence needs finite-range conversion.');
  const rule=rules[0].getFirstValue() as ICAL.Recur; const data:any=rule.toJSON(); const frequency=data.freq;
  for(const key of ['byday','bymonthday','bymonth'])if(data[key]!==undefined&&!Array.isArray(data[key]))data[key]=[data[key]];
  if (!['DAILY','WEEKLY','MONTHLY','YEARLY'].includes(frequency)) throw new Error('This recurrence frequency needs finite-range conversion.');
  const allowed=['freq','interval','count','until','wkst','byday','bymonthday','bymonth'];
  if(Object.keys(data).some(k=>!allowed.includes(k.toLowerCase()))) throw new Error('This recurrence pattern needs finite-range conversion.');
  const byday=(data.byday??[]).map(String); const map=['MO','TU','WE','TH','FR','SA','SU'];
  let weekdays:number[]=[],monthlyMode:'date'|'ordinal'='date',ordinal=1;
  if(frequency==='WEEKLY') { if(byday.some((s:string)=>!map.includes(s)))throw new Error('Ordinal weekly recurrence needs conversion.');weekdays=byday.map((s:string)=>map.indexOf(s)+1); }
  else if(frequency==='MONTHLY'&&byday.length) {const match=byday.length===1&&/^(-1|[1-5])(MO|TU|WE|TH|FR|SA|SU)$/.exec(byday[0]);if(!match||map.indexOf(match[2])+1!==DateTime.fromISO(first).weekday)throw new Error('This monthly recurrence needs finite-range conversion.');monthlyMode='ordinal';ordinal=Number(match[1]);}
  else if(byday.length)throw new Error('This recurrence weekday filter needs finite-range conversion.');
  const day=DateTime.fromISO(first);
  if(data.bymonthday && (!['MONTHLY','YEARLY'].includes(frequency)||data.bymonthday.length!==1||Number(data.bymonthday[0])!==day.day)) throw new Error('This day-of-month pattern needs finite-range conversion.');
  if(data.bymonth && (frequency!=='YEARLY'||data.bymonth.length!==1||Number(data.bymonth[0])!==day.month)) throw new Error('This month filter needs finite-range conversion.');
  if(data.wkst&&data.wkst!=='MO'&&data.wkst!==2&&Number(data.interval??1)>1)throw new Error('This recurrence week boundary needs finite-range conversion.');
  const dateValues=(name:string)=>component.getAllProperties(name).flatMap(p=>p.getValues().map(v=>{const time=v as ICAL.Time;if(time.icaltype!=='date'&&time.icaltype!=='date-time')throw new Error('Period dates need finite-range conversion.');if(timing.mode==='timed'&&!time.isDate){const normalized=time.zone?.tzid==='UTC'?DateTime.fromSeconds(time.toUnixTime(),{zone:timing.zone}):DateTime.fromISO(time.toString(),{zone:timing.zone});if(normalized.toFormat('HH:mm:ss')!==DateTime.fromISO(timing.start).setZone(timing.zone).toFormat('HH:mm:ss'))throw new Error('Additional dates with a different time need finite-range conversion.');return normalized.toISODate()!;}return time.toString().slice(0,10);}));
  const until=data.until?DateTime.fromISO(String(data.until),{zone:timing.zone}).setZone(timing.zone).toISODate():null;
  return recurrenceSchema.parse({frequency,interval:data.interval??1,count:data.count??null,until,weekdays,monthlyMode,ordinal,excludedDates:dateValues('exdate'),extraDates:dateValues('rdate')});
}
function componentItem(component:ICAL.Component, options:ParseOptions, forceStandalone=false):CalendarItem {
  const source=String(component.getFirstPropertyValue('uid')??'');if(!source||source.length>1000)throw new Error('Missing or oversized UID.');
  const isTodo=component.name==='vtodo',startProperty=component.getFirstProperty(isTodo?'due':'dtstart');
  let timing:Timing={mode:'unscheduled',zone:options.zone};
  if(startProperty){
    const start=readTime(startProperty,options.zone,!!options.finiteRange);
    if(isTodo)timing={mode:'deadline',date:start.date,time:start.allDay?null:DateTime.fromISO(start.instant).setZone(start.zone).toFormat('HH:mm'),zone:start.zone,anchorTime:'09:00'};
    else if(start.allDay){const end=component.getFirstProperty('dtend');const duration=component.getFirstPropertyValue('duration') as ICAL.Duration|null;timing={mode:'allDay',startDate:start.date,endDate:end?readTime(end,options.zone).date:addDays(start.date,Math.max(1,Math.ceil((duration?.toSeconds()??86400)/86400))),zone:start.zone,anchorTime:'09:00'};}
    else {const end=component.getFirstProperty('dtend'),duration=component.getFirstPropertyValue('duration') as ICAL.Duration|null;timing={mode:'timed',start:start.instant,end:end?readTime(end,options.zone,!!options.finiteRange).instant:DateTime.fromISO(start.instant).plus({seconds:duration?.toSeconds()??3600}).toUTC().toISO()!,zone:start.zone};}
  }else if(!isTodo)throw new Error('Event has no start date.');
  const deadline=component.getFirstPropertyValue('x-cclime-deadline');
  if(deadline&&startProperty){const zone=zoneSchema.parse(component.getFirstPropertyValue('x-cclime-zone')??options.zone),start=readTime(startProperty,zone,!!options.finiteRange);timing={mode:'deadline',date:deadline==='DATE'?start.date:DateTime.fromISO(start.instant).setZone(zone).toISODate()!,time:deadline==='DATE'?null:String(deadline),zone,anchorTime:String(component.getFirstPropertyValue('x-cclime-anchor')??'09:00')};}
  const nativeType=component.getFirstPropertyValue('x-cclime-type');const itemType=['class','event','assignment','exam','study','task'].includes(String(nativeType))?nativeType:isTodo?'task':'event';
  const nativeStatus=component.getFirstPropertyValue('x-cclime-status');const status=component.getFirstPropertyValue('status')==='COMPLETED'||nativeStatus==='completed'?'completed':nativeStatus==='in_progress'?'in_progress':'open';
  if(component.getFirstPropertyValue('status')==='CANCELLED')throw new Error('Canceled event skipped.');
  const reminders=component.getAllSubcomponents('valarm').flatMap((alarm,i)=>{const trigger=alarm.getFirstPropertyValue('trigger') as ICAL.Duration; if(alarm.getFirstPropertyValue('action')!=='DISPLAY'||!trigger||typeof trigger.toSeconds!=='function')return [];const seconds=trigger.toSeconds();return seconds<=0&&seconds>=-30*86400?[{id:stableId(`${source}:alarm:${i}`),minutesBefore:Math.floor(-seconds/60)}]:[];}).slice(0,5);
  const first=sourceDate(timing);
  return itemSchema.parse({id:randomUUID(),kind:'item',title:String(component.getFirstPropertyValue('summary')??'Untitled event'),notes:String(component.getFirstPropertyValue('description')??''),location:String(component.getFirstPropertyValue('location')??''),itemType,timing,status,sourceUid:source,recurrence:forceStandalone||!first?null:nativeRecurrence(component,first,timing),reminders});
}
export function parseCalendar(text:string,options:ParseOptions):ParsedCalendar {
  if(Buffer.byteLength(text,'utf8')>10*1024*1024)throw new Error('Choose a calendar file smaller than 10 MiB.');
  zoneSchema.parse(options.zone);if(options.finiteRange){localDate.parse(options.finiteRange.from);localDate.parse(options.finiteRange.to);if(options.finiteRange.to<options.finiteRange.from)throw new Error('Invalid conversion date range.');}
  ICAL.TimezoneService.reset();
  let calendar:ICAL.Component;try{calendar=new ICAL.Component(ICAL.parse(text));}catch{throw new Error('This file is not a valid iCalendar file.');}
  if(calendar.name!=='vcalendar')throw new Error('The file needs a VCALENDAR container.');
  for(const tz of calendar.getAllSubcomponents('vtimezone'))ICAL.TimezoneService.register(new ICAL.Timezone(tz));
  const components=calendar.getAllSubcomponents().filter(c=>['vevent','vtodo'].includes(c.name));if(components.length>5000)throw new Error('Import at most 5,000 calendar items at once.');
  const records:DomainRecord[]=[],warnings:string[]=[];let invalid=0;
  const masters=new Map<string,CalendarItem>();const seen=new Set<string>();
  for(const c of components.filter(c=>!c.hasProperty('recurrence-id'))){
    const source=String(c.getFirstPropertyValue('uid')??'');
    if(seen.has(source)){warnings.push(`Duplicate UID in this file was skipped: ${source.slice(0,80)}`);invalid++;continue;}seen.add(source);
    try {
      const value=componentItem(c,options);records.push(value);masters.set(source,value);
      const start=c.getFirstProperty('dtstart')??c.getFirstProperty('due');const t=start?.getFirstValue() as ICAL.Time|undefined;
      if(t&&!t.isDate&&!start?.getParameter('tzid')&&t.zone?.tzid!=='UTC')warnings.push(`“${value.title}” uses floating times, interpreted in ${options.zone}.`);
      if(c.hasProperty('attendee')||c.hasProperty('attach'))warnings.push(`Attendees/attachments in “${value.title}” are not imported; no invitations are sent.`);
    }catch(error){
      if(options.finiteRange&&c.name==='vevent'){
        try{
          // Do not save part of a conversion when a later occurrence is invalid.
          if(components.some(v=>v.hasProperty('recurrence-id')&&v.getFirstPropertyValue('uid')===source))throw new Error('Finite conversion with occurrence overrides is not supported. Export this series as standalone events from its original calendar.');
          const base=componentItem(c,options,true),event=new ICAL.Event(c),iterator=event.iterator(),converted:DomainRecord[]=[];
          const startProperty=c.getFirstProperty('dtstart')!,startValue=startProperty.getFirstValue() as ICAL.Time;
          const sourceZone=String(startProperty.getParameter('tzid')??(startValue.zone?.tzid==='UTC'?'UTC':options.zone));
          const instant=(time:ICAL.Time)=>sourceZone==='UTC'||IANAZone.isValidZone(sourceZone)?localInstant(time.toString().slice(0,10),time.toString().slice(11,16),sourceZone).plus({seconds:time.second}).toUTC():DateTime.fromMillis(time.toUnixTime()*1000,{zone:'UTC'});
          let n=0;while(n++<20000){
            const next=iterator.next();if(!next)break;const date=next.toString().slice(0,10);if(date>options.finiteRange.to)break;if(date<options.finiteRange.from)continue;
            const details=event.getOccurrenceDetails(next);
            converted.push(itemSchema.parse({...base,id:randomUUID(),sourceUid:`${source}#${next.toString()}`,timing:next.isDate?{mode:'allDay',startDate:date,endDate:details.endDate.toString().slice(0,10),zone:options.zone,anchorTime:'09:00'}:{mode:'timed',start:instant(details.startDate).toISO(),end:instant(details.endDate).toISO(),zone:'UTC'}}));
          }
          if(n>=20000)throw new Error('Conversion exceeds 20,000 occurrence steps. Narrow the date range.');
          records.push(...converted);warnings.push(`Converted “${base.title}” into ${converted.length} standalone events. Recurrence outside the chosen range is not retained.`);continue;
        }catch(convertError){warnings.push(String((convertError as Error).message));}
      }
      warnings.push(`${source.slice(0,80)||'Calendar item'}: ${(error as Error).message}`);invalid++;
    }
    if(records.length>20000)throw new Error('Preview exceeds 20,000 occurrences. Narrow the date range.');
  }
  for(const c of components.filter(c=>c.hasProperty('recurrence-id'))){
    try{const source=String(c.getFirstPropertyValue('uid')??''),master=masters.get(source);if(!master?.recurrence)throw new Error('Occurrence override has no supported recurring parent.');const original=readTime(c.getFirstProperty('recurrence-id'),master.timing.zone).date;const cancelled=c.getFirstPropertyValue('status')==='CANCELLED';const value=cancelled?null:componentItem(c,options,true);records.push(parseRecord({id:randomUUID(),kind:'exception',seriesId:master.id,originalDate:original,cancelled,override:value?{title:value.title,timing:value.timing,notes:value.notes,location:value.location,reminders:value.reminders}:{}}));}catch(error){warnings.push((error as Error).message);invalid++;}
  }
  if(records.length>5000)throw new Error('Conversion produced more than 5,000 records. Choose a smaller date range.');
  return {records,warnings,invalid};
}
function importedContent(record:DomainRecord):unknown { const {id,...rest}=record; if(record.kind==='item'){const {courseId,assignmentId,...content}=rest as any;return content;}return rest; }
export function previewImport(parsed:ParsedCalendar,existing:DomainRecord[]):ImportCandidate[]{
  const bySource=new Map(existing.filter((r):r is CalendarItem=>r.kind==='item'&&!!r.sourceUid).map(r=>[r.sourceUid!,r]));
  const idMap=new Map<string,string>();
  for(const r of parsed.records)if(r.kind==='item'&&r.sourceUid){const old=bySource.get(r.sourceUid);if(old)idMap.set(r.id,old.id);}
  return parsed.records.map(r=>{
    let record=r,old:DomainRecord|undefined;
    if(r.kind==='item'){old=r.sourceUid?bySource.get(r.sourceUid):undefined;if(old?.kind==='item')record={...r,id:old.id,courseId:old.courseId,assignmentId:old.assignmentId};}
    else if(r.kind==='exception'){const seriesId=idMap.get(r.seriesId)??r.seriesId;old=existing.find(v=>v.kind==='exception'&&v.seriesId===seriesId&&v.originalDate===r.originalDate);record={...r,id:old?.id??r.id,seriesId};}
    const sourceHash=hash(importedContent(record));return{record,sourceHash,action:!old?'new':sourceHash===hash(importedContent(old))?'identical':'changed',existingId:old?.id};
  });
}
function property(name:string,value:any,type?:string):ICAL.Property{const p=new ICAL.Property(name);if(type)p.resetType(type);p.setValue(value);return p;}
function timeProperty(name:string,iso:string,dateOnly=false,tz?:string):ICAL.Property{const p=new ICAL.Property(name);p.resetType(dateOnly?'date':'date-time');if(tz&&tz!=='UTC')p.setParameter('tzid',tz);p.setValue(ICAL.Time.fromString(dateOnly?iso:iso, null));return p;}
function eventComponent(item:CalendarItem,uid:string):ICAL.Component {
  const c=new ICAL.Component(item.timing.mode==='unscheduled'?'vtodo':'vevent');c.addPropertyWithValue('uid',uid);c.addPropertyWithValue('dtstamp',ICAL.Time.fromJSDate(new Date(),true));c.addPropertyWithValue('summary',item.title);c.addPropertyWithValue('description',item.notes);c.addPropertyWithValue('location',item.location);c.addPropertyWithValue('x-cclime-type',item.itemType);c.addPropertyWithValue('x-cclime-status',item.status);
  const t=item.timing;
  if(t.mode==='unscheduled'){if(item.status==='completed')c.addPropertyWithValue('status','COMPLETED');}
  if(t.mode==='timed'){
    const tz=item.recurrence?t.zone:'UTC';
    for(const [name,iso]of [['dtstart',t.start],['dtend',t.end]]){const d=DateTime.fromISO(iso).setZone(tz);c.addProperty(timeProperty(name,d.toFormat("yyyy-MM-dd'T'HH:mm:ss")+(tz==='UTC'?'Z':''),false,tz));}
  }
  if(t.mode==='allDay'){c.addProperty(timeProperty('dtstart',t.startDate,true));c.addProperty(timeProperty('dtend',t.endDate,true));}
  if(t.mode==='deadline'){
    if(t.time){const start=localInstant(t.date,t.time,t.zone).toUTC();c.addProperty(timeProperty('dtstart',start.toFormat("yyyy-MM-dd'T'HH:mm:ss'Z'")));c.addProperty(timeProperty('dtend',start.plus({minutes:1}).toFormat("yyyy-MM-dd'T'HH:mm:ss'Z'")));}
    else {c.addProperty(timeProperty('dtstart',t.date,true));c.addProperty(timeProperty('dtend',addDays(t.date,1),true));}
    c.addPropertyWithValue('x-cclime-deadline',t.time??'DATE');c.addPropertyWithValue('x-cclime-zone',t.zone);c.addPropertyWithValue('x-cclime-anchor',t.anchorTime);
  }
  if(item.recurrence){const first=sourceDate(t)!;let rule=recurrenceRule(item.recurrence,first);if(t.mode==='timed'&&item.recurrence.until){const time=DateTime.fromISO(t.start).setZone(t.zone).toFormat('HH:mm');const until=localInstant(item.recurrence.until,time,t.zone).toUTC().toFormat("yyyyMMdd'T'HHmmss'Z'");rule=rule.replace(/UNTIL=\d{8}/,`UNTIL=${until}`);}c.addProperty(property('rrule',ICAL.Recur.fromString(rule)));for(const [field,dates]of [['exdate',item.recurrence.excludedDates],['rdate',item.recurrence.extraDates]]as const)for(const date of dates){if(t.mode==='allDay')c.addProperty(timeProperty(field,date,true));else if(t.mode==='timed')c.addProperty(timeProperty(field,`${date}T${DateTime.fromISO(t.start).setZone(t.zone).toFormat('HH:mm:ss')}`,false,t.zone));}}
  for(const reminder of item.reminders){const alarm=new ICAL.Component('valarm');alarm.addPropertyWithValue('action','DISPLAY');alarm.addPropertyWithValue('description',item.title);alarm.addPropertyWithValue('trigger',ICAL.Duration.fromSeconds(-reminder.minutesBefore*60));c.addSubcomponent(alarm);}
  return c;
}
export function exportCalendar(records:DomainRecord[],options:{courses?:string[];range?:{from:string;to:string};zone:string}):string {
  const calendar=new ICAL.Component('vcalendar');calendar.addPropertyWithValue('version','2.0');calendar.addPropertyWithValue('prodid','-//C.C. Lime//Student Calendar//EN');calendar.addPropertyWithValue('calscale','GREGORIAN');
  const chosen=records.filter(r=>r.kind!=='item'||!options.courses?.length||!!r.courseId&&options.courses.includes(r.courseId));
  if(options.range){for(const o of expand(chosen,options.range.from,addDays(options.range.to,1),options.zone,20000))calendar.addSubcomponent(eventComponent({...o,recurrence:null},`${o.occurrenceKey}@cc-lime.app`));}
  else for(const r of chosen)if(r.kind==='item'){
    const uid=r.sourceUid??`${r.id}@cc-lime.app`;calendar.addSubcomponent(eventComponent(r,uid));
    for(const exception of chosen.filter(e=>e.kind==='exception'&&e.seriesId===r.id))if(exception.kind==='exception'){
      const c=eventComponent({...r,...exception.override,timing:exception.override.timing??atDate(r.timing,exception.originalDate),recurrence:null},uid);
      if(r.timing.mode==='allDay')c.addProperty(timeProperty('recurrence-id',exception.originalDate,true));
      else if(r.timing.mode==='timed')c.addProperty(timeProperty('recurrence-id',`${exception.originalDate}T${DateTime.fromISO(r.timing.start).setZone(r.timing.zone).toFormat('HH:mm:ss')}`,false,r.timing.zone));
      if(exception.cancelled)c.addPropertyWithValue('status','CANCELLED');calendar.addSubcomponent(c);
    }
  }
  return calendar.toString()+'\r\n';
}
const backupSchema=z.object({format:z.literal('cc-lime-backup'),version:z.literal(1),accountId:z.string().max(128),createdAt:z.string(),records:z.array(z.unknown()).max(50000),checksum:z.string().length(64)}).strict();
export function createBackup(accountId:string,records:DomainRecord[]):string {const data={format:'cc-lime-backup' as const,version:1 as const,accountId,createdAt:new Date().toISOString(),records:records.map(parseRecord)};return JSON.stringify({...data,checksum:hash(data)},null,2);}
export function readBackup(text:string):{accountId:string;records:DomainRecord[];createdAt:string}{if(Buffer.byteLength(text)>50*1024*1024)throw new Error('Backup exceeds the 50 MiB limit.');const data=backupSchema.parse(JSON.parse(text));const{checksum,...body}=data;if(hash(body)!==checksum)throw new Error('The backup checksum does not match. The file may be damaged.');const records=data.records.map(parseRecord),ids=new Map(records.map(r=>[r.id,r]));if(ids.size!==records.length)throw new Error('Backup contains duplicate identities.');for(const r of records){const refs=r.kind==='item'?[r.courseId,r.assignmentId]:r.kind==='course'?[r.semesterId]:r.kind==='exception'||r.kind==='occurrenceState'?[r.seriesId]:[];if(refs.some(id=>id&&!ids.has(id)))throw new Error('Backup contains a missing relationship.');}return{accountId:data.accountId,records,createdAt:data.createdAt};}
export function remapBackup(records:DomainRecord[],existingPreferences?:string):DomainRecord[]{const map=new Map(records.map(r=>[r.id,r.kind==='preferences'&&existingPreferences?existingPreferences:randomUUID()]));return records.map(r=>{const next:any={...r,id:map.get(r.id)};if(r.kind==='item'){next.courseId=r.courseId?map.get(r.courseId):null;next.assignmentId=r.assignmentId?map.get(r.assignmentId):null;next.reminders=r.reminders.map(rule=>({...rule,id:randomUUID()}));next.sourceUid=null;}if(r.kind==='course')next.semesterId=r.semesterId?map.get(r.semesterId):null;if(r.kind==='exception'||r.kind==='occurrenceState')next.seriesId=map.get(r.seriesId);return parseRecord(next);});}
