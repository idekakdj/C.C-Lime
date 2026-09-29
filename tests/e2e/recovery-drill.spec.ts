import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { makeItem, courseSchema, semesterSchema, preferencesSchema, type Snapshot, type DomainRecord } from '../../src/shared/model';
import { readBackup } from '../../src/domain/interchange';

const executable=process.env.CC_LIME_TEST_EXECUTABLE??path.resolve('out/C.C. Lime-win32-x64/cc-lime.exe');
const ordered=(records:DomainRecord[])=>[...records].sort((a,b)=>a.id.localeCompare(b.id));
const hash=(bytes:string|Buffer)=>createHash('sha256').update(bytes).digest('hex');

test('restores a linked calendar into an empty profile and rejects a damaged backup without losing recovered data',async({},testInfo)=>{
  const root=path.resolve('test-results/profiles',`recovery-drill-${randomUUID()}`),source=path.join(root,'source'),destination=path.join(root,'destination'),backup=path.join(root,'calendar-backup.json');
  await fs.mkdir(root,{recursive:true});let app:ElectronApplication|undefined,page!:Page;
  const errors:string[]=[];
  const call=<T=unknown>(command:string,payload?:unknown)=>page.evaluate(({command,payload})=>window.lime.call<T>(command,payload),{command,payload});
  async function open(profile:string){
    app=await electron.launch({executablePath:executable,args:[`--cc-lime-test-profile=${profile}`],timeout:60000});
    page=await app.firstWindow();page.on('pageerror',error=>errors.push(error.message));
    await page.getByRole('button',{name:/Explore a local calendar/}).click();
    await page.getByRole('heading',{name:'Your calendar',exact:true}).waitFor();
    await call('device',{onboardingDone:true});
  }
  try{
    await open(source);
    const date='2026-09-18',zone='America/Toronto';
    const semester=semesterSchema.parse({id:randomUUID(),kind:'semester',name:'Recovery semester',startDate:'2026-09-01',endDate:'2026-12-20',zone});
    const course=courseSchema.parse({id:randomUUID(),kind:'course',name:'Recovery course',semesterId:semester.id});
    const assignment={...makeItem(randomUUID(),date,zone,'assignment'),title:'Recovery assignment',courseId:course.id};
    const series={...makeItem(randomUUID(),date,zone,'class'),title:'Recovery recurring class',courseId:course.id,recurrence:{frequency:'DAILY',interval:1,count:4,until:null,weekdays:[],monthlyMode:'date',ordinal:1,excludedDates:[],extraDates:[]}};
    const study={...makeItem(randomUUID(),date,zone,'study'),title:'Recovery study',assignmentId:assignment.id,courseId:course.id};
    const task={...makeItem(randomUUID(),date,zone,'task'),title:'Recovery no-date task',timing:{mode:'unscheduled',zone}};
    const prefs=preferencesSchema.parse({id:randomUUID(),kind:'preferences',zone,weekStart:7,timeFormat:'24'});
    for(const value of [semester,course,assignment,series,study,task,prefs])await call('save',value);
    await call('occurrence',{seriesId:series.id,date,action:'save',override:{title:'Recovery occurrence override',location:'Recovery room'}});
    await call('occurrence',{seriesId:series.id,date,action:'complete'});
    await call('device',{privacy:true,view:'agenda',month:'2026-09',notifications:false});
    const original=await call<Snapshot>('snapshot');expect(original.configured).toBe(false);expect(original.session).toBeNull();expect(original.records).toHaveLength(9);
    await app!.evaluate(({dialog},file)=>{dialog.showSaveDialog=(async()=>({canceled:false,filePath:file}))as any;},backup);
    await call('backup');const bytes=await fs.readFile(backup),decoded=JSON.parse(bytes.toString());
    expect(Object.keys(decoded).sort()).toEqual(['accountId','checksum','createdAt','format','records','version']);
    expect(ordered(readBackup(bytes.toString()).records)).toEqual(ordered(original.records));
    const version=await app!.evaluate(({app})=>app.getVersion());await app!.close();app=undefined;

    const recoveryStarted=performance.now();await open(destination);const initial=await call<Snapshot>('snapshot');
    expect(initial.records).toEqual([]);expect(initial.sync.pending).toBe(0);expect(initial.configured).toBe(false);
    await app!.evaluate(({dialog},file)=>{dialog.showOpenDialog=(async()=>({canceled:false,filePaths:[file]}))as any;},backup);
    const preview=await call<{token:string;count:number;foreign:boolean}>('restore.preview');expect(preview).toMatchObject({count:9,foreign:false});
    await call('restore.commit',{token:preview.token,mode:'merge'});
    const restored=await call<Snapshot&{dataPath:string}>('snapshot');
    expect(ordered(restored.records)).toEqual(ordered(original.records));expect(restored.sync.pending).toBe(9);
    expect(restored.device.privacy).toBe(false);expect(restored.device.view).toBe('month');expect(restored.device.notifications).toBe(false);
    expect(restored.session).toBeNull();expect(restored.reminders).toEqual([]);
    const snapshots=await fs.readdir(path.join(restored.dataPath,'backups'));expect(snapshots.some(name=>name.startsWith('before-restore-'))).toBe(true);
    await page.locator('.app-shell[data-calendar-ready="true"]').waitFor();
    const recoveryMs=performance.now()-recoveryStarted;
    await app!.close();app=undefined;await open(destination);
    const restarted=await call<Snapshot>('snapshot');expect(ordered(restarted.records)).toEqual(ordered(original.records));expect(restarted.sync.pending).toBe(9);
    const damaged=path.join(root,'damaged-backup.json');decoded.records[0].id=randomUUID();await fs.writeFile(damaged,JSON.stringify(decoded));
    await app!.evaluate(({dialog},file)=>{dialog.showOpenDialog=(async()=>({canceled:false,filePaths:[file]}))as any;},damaged);
    await expect(call('restore.preview')).rejects.toThrow('checksum');
    const unchanged=await call<Snapshot>('snapshot');expect(ordered(unchanged.records)).toEqual(ordered(original.records));expect(unchanged.sync.pending).toBe(9);
    expect(errors).toEqual([]);
    const summary={date:new Date().toISOString(),version,complete:true,records:9,pendingWrites:9,backupCreatedAt:decoded.createdAt,backupSha256:hash(bytes),recordsSha256:hash(JSON.stringify(ordered(original.records))),asarSha256:hash(await fs.readFile(path.join(path.dirname(executable),'resources/app.asar'))),recoveryMs,checks:{linkedRecords:true,overrideAndCompletion:true,deviceAndSessionExcluded:true,preRestoreSnapshot:true,restartDurability:true,damagedBackupRejected:true,unchangedAfterRejection:true},scope:'Synthetic same-account logical backup into a separate empty local profile on one Windows host. Recovery timing includes launching the empty profile through readiness; no approved RTO/RPO, off-device encryption, cloud restore, user outage or human tabletop is verified.'};
    const reportPath=testInfo.outputPath('recovery-summary.json');await fs.writeFile(reportPath,JSON.stringify(summary,null,2));await testInfo.attach('recovery-summary',{path:reportPath,contentType:'application/json'});
  }finally{await app?.close();}
});
