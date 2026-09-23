import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Worker } from 'node:worker_threads';
import { z } from 'zod';
import { DateTime } from 'luxon';
import { LocalStore } from './store';
import { AuthService, type SecureStorage } from './auth';
import { FirestoreCloud } from './cloud';
import { SyncEngine } from './sync';
import { ReminderScheduler, type ReminderNotice } from './scheduler';
import { atDate, recurringDates, sourceDate, addDays, localInstant } from '../domain/calendar';
import { createBackup, readBackup, remapBackup, previewImport, type ParsedCalendar, type ParseOptions } from '../domain/interchange';
import { defaultDeviceSettings, parseRecord, preferencesSchema, localDate, localTime, uid, zone as zoneSchema, type CloudConfiguration, type DeviceSettings, type DomainRecord, type ImportPreview, type Preferences, type Snapshot, type CalendarItem } from '../shared/model';

const deviceSchema=z.object({notifications:z.boolean(),startAtLogin:z.boolean(),closeToTray:z.boolean(),quietStart:localTime.nullable(),quietEnd:localTime.nullable(),privacy:z.boolean(),followZone:z.boolean(),onboardingDone:z.boolean(),view:z.enum(['month','week','agenda']),month:z.string().regex(/^\d{4}-\d{2}$/).nullable(),hideCompleted:z.boolean()}).strict();
export interface HostServices {
  secure:SecureStorage; openBrowser(url:string):Promise<void>; changed():void; notify(notice:ReminderNotice):void;
  openFile(kind:'ics'|'backup'):Promise<string|null>; saveFile(kind:'ics'|'backup'|'diagnostics'):Promise<string|null>;
  setStartup(enabled:boolean):void; startupStatus():{enabled:boolean;wasOpenedAtLogin:boolean}; dataFolder():void; version:string;
}
export class ApplicationService {
  readonly auth:AuthService;
  store:LocalStore|null=null;
  sync:SyncEngine|null=null;
  scheduler:ReminderScheduler|null=null;
  device:DeviceSettings={...defaultDeviceSettings};
  recoveryError:string|null=null;
  private localMode=false;
  private switching=false;
  private cloud:FirestoreCloud|null=null;
  private worker:Worker|null=null;
  private imports=new Map<string,{preview:ImportPreview;account:string}>();
  private restorePreview:{token:string;records:DomainRecord[];account:string;foreign:boolean;count:number}|null=null;
  private readonly settingsPath:string;
  constructor(readonly root:string,readonly config:CloudConfiguration|null,private host:HostServices){
    fs.mkdirSync(root,{recursive:true});this.settingsPath=path.join(root,'device.json');
    try{this.device=deviceSchema.parse({...defaultDeviceSettings,...JSON.parse(fs.readFileSync(this.settingsPath,'utf8'))});}catch{}
    this.auth=new AuthService(config,root,host.secure,url=>host.openBrowser(url),()=>host.changed());
  }
  async initialize():Promise<void>{this.auth.restore();if(this.auth.session)await this.activate(this.auth.session.uid);}
  preferences():Preferences{
    const existing=this.store?.list().find((r):r is Preferences=>r.kind==='preferences');
    return existing??preferencesSchema.parse({id:'c44ba791-5ae6-5ec6-9813-0c840db2f0f2',kind:'preferences',zone:DateTime.local().zoneName??'UTC'});
  }
  private async activate(accountId:string,local=false):Promise<void>{
    this.switching=true;this.host.changed();await this.stopServices();this.store?.close();this.store=null;this.localMode=local;this.imports.clear();this.restorePreview=null;
    try{
      this.store=new LocalStore(this.root,accountId);this.recoveryError=null;
      this.scheduler=new ReminderScheduler(this.store,()=>this.device,()=>this.preferences().zone,n=>this.host.notify(n),()=>this.host.changed());this.scheduler.start();
      if(this.config&&!local){this.cloud=new FirestoreCloud(this.config.projectId,accountId,()=>this.auth.token());this.sync=new SyncEngine(this.store,this.cloud,()=>this.auth.session,()=>{this.scheduler?.reconcile();this.host.changed();});this.sync.start();}
    }catch(error){this.recoveryError=(error as Error).message;}
    finally{this.switching=false;this.host.changed();}
  }
  private async stopServices(){this.scheduler?.stop();this.scheduler=null;await this.sync?.stop();this.sync=null;this.cloud=null;}
  async close(){this.auth.cancelGoogle();await this.stopServices();this.worker?.terminate();this.store?.close();this.store=null;}
  setVisible(visible:boolean){this.sync?.setVisible(visible);}
  resume(){this.scheduler?.reconcile();this.sync?.schedule(100);}
  private active():LocalStore{if(this.switching||!this.store)throw new Error('Open a calendar account first.');return this.store;}
  private changed(){this.scheduler?.reconcile();this.sync?.schedule();this.host.changed();}
  snapshot():Snapshot&{recoveryError:string|null;remembered:boolean;dataPath:string;startup:{enabled:boolean;wasOpenedAtLogin:boolean}}{
    return {records:this.switching?[]:this.store?.list()??[],session:this.auth.session,device:this.device,sync:this.sync?.status??{state:'local',pending:this.store?.queue().length??0,lastSynced:null,message:this.localMode?'Local preview — saved on this computer.':'Sign in to open your calendar.'},conflicts:this.store?.conflicts()??[],reminders:this.store?.reminders().slice(0,500)??[],configured:!!this.config,googleConfigured:!!this.config?.googleClientId,version:this.host.version,localMode:this.localMode,recoveryError:this.recoveryError,remembered:this.auth.remembered,dataPath:this.store?.directory??this.root,startup:this.host.startupStatus()};
  }
  private async work<T>(type:'parse'|'export',payload:unknown):Promise<T>{
    if(this.worker)throw new Error('Another calendar file is being processed.');
    return new Promise((resolve,reject)=>{const worker=new Worker(path.join(__dirname,'interchange-worker.cjs'));this.worker=worker;let settled=false;
      const finish=(error:Error|null,result?:T)=>{if(settled)return;settled=true;clearTimeout(timer);this.worker=null;void worker.terminate();error?reject(error):resolve(result!);};
      const timer=setTimeout(()=>finish(new Error('This calendar took too long to process. Choose a smaller file or date range.')),30000);
      worker.once('message',message=>message.ok?finish(null,message.result):finish(new Error(message.error)));worker.once('error',error=>finish(error instanceof Error?error:new Error('File processing failed.')));worker.once('exit',code=>{if(!settled)finish(new Error(code===0?'File processing was canceled.':'File processing stopped.'));});worker.postMessage({type,payload});
    });
  }
  async command(command:string,payload:any):Promise<any>{
    switch(command){
      case 'snapshot':return this.snapshot();
      case 'auth.signIn':{const p=z.object({email:z.string(),password:z.string()}).strict().parse(payload);const session=await this.auth.signIn(p.email,p.password);await this.activate(session.uid);return true;}
      case 'auth.signUp':{const p=z.object({email:z.string(),password:z.string(),name:z.string()}).strict().parse(payload);const session=await this.auth.signUp(p.email,p.password,p.name);await this.activate(session.uid);await this.auth.sendVerification();return true;}
      case 'auth.google':{const p=z.object({link:z.boolean().default(false)}).strict().parse(payload??{});const old=this.auth.session?.uid;const session=await this.auth.google(p.link);if(session.uid!==old||!this.store)await this.activate(session.uid);return true;}
      case 'auth.cancel':this.auth.cancelGoogle();return true;
      case 'auth.verify':await this.auth.sendVerification();return true;
      case 'auth.refresh':await this.auth.refreshProfile();this.sync?.schedule(0);this.host.changed();return true;
      case 'auth.reset':await this.auth.resetPassword(z.object({email:z.string()}).strict().parse(payload).email);return true;
      case 'auth.linkPassword':await this.auth.linkPassword(z.object({password:z.string()}).strict().parse(payload).password);return true;
      case 'auth.signOut':await this.stopServices();this.store?.close();this.store=null;this.localMode=false;this.auth.signOut();this.imports.clear();this.host.changed();return true;
      case 'localPreview':if(this.auth.session)throw new Error('Sign out before opening a local preview.');await this.activate('local-preview',true);return true;
      case 'save':{
        const value=parseRecord(payload),store=this.active();
        if(value.kind==='item'){
          if(value.timing.mode==='deadline')localInstant(value.timing.date,value.timing.time??value.timing.anchorTime,value.timing.zone);
          const old=store.get(value.id);if(old?.kind==='item'&&old.recurrence){
            const dependent=store.list().filter(r=>(r.kind==='exception'||r.kind==='occurrenceState')&&r.seriesId===value.id);
            for(const r of dependent)if((r.kind==='exception'||r.kind==='occurrenceState')&&(!value.recurrence||!recurringDates(value,r.originalDate,addDays(r.originalDate,1)).includes(r.originalDate)))throw new Error('This repeat change removes an occurrence with an edit or completion history. Keep the current pattern, or detach those occurrences first.');
          }
        }
        const result=store.save(value);this.changed();return result;
      }
      case 'remove':{const p=z.object({id:uid}).strict().parse(payload);const token=this.active().remove(p.id);this.changed();return {undoToken:token};}
      case 'undo':{const p=z.object({token:uid}).strict().parse(payload);this.active().undo(p.token);this.changed();return true;}
      case 'occurrence':{
        const p=z.object({seriesId:uid,date:localDate,action:z.enum(['save','cancel','complete','reopen','detach']),override:z.unknown().optional()}).strict().parse(payload),store=this.active();const series=store.get(p.seriesId);
        if(series?.kind!=='item'||!series.recurrence)throw new Error('This repeating item is unavailable.');
        if(p.action==='complete'||p.action==='reopen'){
          const old=store.list().find(r=>r.kind==='occurrenceState'&&r.seriesId===p.seriesId&&r.originalDate===p.date);
          store.save({id:old?.id??randomUUID(),kind:'occurrenceState',seriesId:p.seriesId,originalDate:p.date,status:p.action==='complete'?'completed':'open',completedAt:p.action==='complete'?new Date().toISOString():null});
        }else{
          const old=store.list().find(r=>r.kind==='exception'&&r.seriesId===p.seriesId&&r.originalDate===p.date);
          if(p.action==='detach'){
            const effective=old?.kind==='exception'?old.override:{};
            store.importRecords([{...series,...effective,id:randomUUID(),timing:effective.timing??atDate(series.timing,p.date),recurrence:null,sourceUid:null},{id:old?.id??randomUUID(),kind:'exception',seriesId:p.seriesId,originalDate:p.date,cancelled:true,override:{}}]);
          }else store.save({id:old?.id??randomUUID(),kind:'exception',seriesId:p.seriesId,originalDate:p.date,cancelled:p.action==='cancel',override:p.action==='save'?p.override??{}:{}});
        }
        this.changed();return true;
      }
      case 'complete':{
        const p=z.object({id:uid,completed:z.boolean()}).strict().parse(payload),store=this.active(),item=store.get(p.id);if(item?.kind!=='item')throw new Error('Item not found.');if(item.recurrence)throw new Error('Choose a specific occurrence to complete.');const result=store.save({...item,status:p.completed?'completed':'open',completedAt:p.completed?new Date().toISOString():null});this.changed();return result;
      }
      case 'device':{
        const next=deviceSchema.parse({...this.device,...payload});if(next.startAtLogin!==this.device.startAtLogin)this.host.setStartup(next.startAtLogin);
        fs.writeFileSync(`${this.settingsPath}.new`,JSON.stringify(next));fs.renameSync(`${this.settingsPath}.new`,this.settingsPath);this.device=next;this.changed();return true;
      }
      case 'sync':await this.sync?.retry();return true;
      case 'conflict':{const p=z.object({id:uid,choice:z.enum(['local','remote','both'])}).strict().parse(payload);const store=this.active(),conflict=store.conflicts().find(c=>c.id===p.id);if(!conflict||!this.cloud)throw new Error('Reconnect to review this conflict.');store.resolve(p.id,p.choice,await this.cloud.get(conflict.recordId));this.changed();return true;}
      case 'testNotification':this.host.notify({title:'C.C. Lime',body:'Your test reminder has been submitted to Windows.',inbox:true,onFailure:()=>{}});return true;
      case 'snooze':{const p=z.object({id:z.string().max(250),minutes:z.number()}).strict().parse(payload);this.scheduler?.snooze(p.id,p.minutes);return true;}
      case 'dismissReminder':this.scheduler?.dismiss(z.object({id:z.string().max(250)}).strict().parse(payload).id);return true;
      case 'import.preview':{
        const p=z.object({zone:zoneSchema,finiteRange:z.object({from:localDate,to:localDate}).optional()}).strict().parse(payload),store=this.active(),account=store.accountId;
        const filename=await this.host.openFile('ics');if(!filename)return null;const stat=fs.statSync(filename);if(stat.size>10*1024*1024)throw new Error('Choose a calendar file smaller than 10 MiB.');
        const parsed=await this.work<ParsedCalendar>('parse',{text:fs.readFileSync(filename,'utf8'),options:p as ParseOptions});if(this.store?.accountId!==account)throw new Error('Account changed; import canceled.');
        const preview:ImportPreview={token:randomUUID(),filename:path.basename(filename),candidates:previewImport(parsed,store.list()),warnings:parsed.warnings,invalid:parsed.invalid};this.imports.clear();this.imports.set(preview.token,{preview,account});return preview;
      }
      case 'import.cancel':await this.worker?.terminate();this.imports.clear();return true;
      case 'import.commit':{
        const p=z.object({token:uid,includeChanged:z.boolean()}).strict().parse(payload),stored=this.imports.get(p.token),store=this.active();if(!stored||stored.account!==store.accountId)throw new Error('Preview expired. Preview the file again.');
        const candidates=stored.preview.candidates.filter(c=>c.action==='new'||p.includeChanged&&c.action==='changed');const idSet=new Set(candidates.map(c=>c.record.id));
        const values=candidates.filter(c=>c.record.kind!=='exception'||idSet.has(c.record.seriesId)||store.get(c.record.seriesId)).map(c=>c.record);
        const batch=store.importRecords(values);this.imports.delete(p.token);this.changed();return {batch,count:values.length};
      }
      case 'import.undo':this.active().undoImport(z.object({batch:uid}).strict().parse(payload).batch);this.changed();return true;
      case 'export':{
        const p=z.object({courses:z.array(uid).max(1000).optional(),range:z.object({from:localDate,to:localDate}).optional()}).strict().parse(payload??{});const records=this.active().list();const destination=await this.host.saveFile('ics');if(!destination)return null;const text=await this.work<string>('export',{records,options:{...p,zone:this.preferences().zone}});fs.writeFileSync(destination,text,'utf8');return path.basename(destination);
      }
      case 'backup':{const store=this.active(),text=createBackup(store.accountId,store.list()),destination=await this.host.saveFile('backup');if(!destination)return null;fs.writeFileSync(destination,text,'utf8');return path.basename(destination);}
      case 'restore.preview':{
        const store=this.active(),account=store.accountId,filename=await this.host.openFile('backup');if(!filename)return null;if(fs.statSync(filename).size>50*1024*1024)throw new Error('Backup exceeds 50 MiB.');const backup=readBackup(fs.readFileSync(filename,'utf8'));if(this.store?.accountId!==account)throw new Error('Account changed.');const token=randomUUID(),foreign=backup.accountId!==account;
        this.restorePreview={token,account,records:backup.records,foreign,count:backup.records.length};return{token,count:backup.records.length,foreign,createdAt:backup.createdAt,filename:path.basename(filename)};
      }
      case 'restore.commit':{
        const p=z.object({token:uid,mode:z.enum(['copies','merge'])}).strict().parse(payload),preview=this.restorePreview,store=this.active();if(!preview||preview.token!==p.token||preview.account!==store.accountId)throw new Error('Restore preview expired.');
        let values=preview.records;
        if(preview.foreign||p.mode==='copies')values=remapBackup(values,store.list().find(r=>r.kind==='preferences')?.id);
        else if(values.some(r=>store.get(r.id)&&JSON.stringify(store.get(r.id))!==JSON.stringify(r)))throw new Error('Existing items differ from this backup. Restore as separate copies to preserve both versions.');
        store.snapshot('before-restore');store.importRecords(values.filter(v=>JSON.stringify(store.get(v.id))!==JSON.stringify(v)));this.restorePreview=null;this.changed();return true;
      }
      case 'dataFolder':this.host.dataFolder();return true;
      case 'diagnostics':{const destination=await this.host.saveFile('diagnostics');if(!destination)return null;fs.writeFileSync(destination,JSON.stringify({version:this.host.version,platform:process.platform,arch:process.arch,electron:process.versions.electron,records:this.store?.list().length??0,pending:this.store?.queue().length??0,conflicts:this.store?.conflicts().length??0,sync:this.sync?.status.state??'local',cloudOperations:this.cloud?.operations??null,notifications:this.device.notifications,secureStorage:this.host.secure.isEncryptionAvailable()},null,2));return true;}
      default:throw new Error('This action is not supported.');
    }
  }
}
