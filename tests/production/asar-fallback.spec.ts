import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createPackage} from '@electron/asar';
import {acceptanceCopy,startDesktop} from './desktop.mjs';
import {absent,ownedProbe,setOwnedFuse,sha256} from './fuse-probes';

for(const fallbackKind of ['directory','default-archive'] as const)test(`onlyLoadAppFromAsar rejects a proven ${fallbackKind} fallback when the archive is missing`,async({},info)=>{
 const control=await acceptanceCopy(),restricted=await acceptanceCopy();
 // The fallback control also exercises the real packaged interchange worker with Node mode disabled.
 for(const copy of [control,restricted])await setOwnedFuse(copy,'runAsNode',false);
 const mutation=await setOwnedFuse(restricted,'onlyLoadAppFromAsar',true);expect(mutation.before.onlyLoadAppFromAsar).toBe(false);
 for(const copy of [control,restricted]){
  const desktop=await startDesktop(copy,path.join(copy.root,'intact-calendar'));
  try{await expect(desktop.page.getByRole('heading',{name:'Your calendar',exact:true})).toBeVisible();}finally{await desktop.close();}
  const resources=path.join(path.dirname(copy.executable),'resources'),archive=path.join(resources,'app.asar'),preserved=path.join(resources,'preserved-app.asar');
  expect(sha256(await fs.readFile(archive))).toBe(copy.packageSha256);expect(await absent(preserved)).toBe(true);
  await fs.rename(archive,preserved);expect(sha256(await fs.readFile(preserved))).toBe(copy.packageSha256);
  const fallback=path.join(resources,'app');await fs.mkdir(fallback);
  await fs.writeFile(path.join(fallback,'package.json'),JSON.stringify({name:'owned-fallback-probe',version:'0.0.0',main:'main.cjs'}),{flag:'wx'});
  await fs.writeFile(path.join(fallback,'main.cjs'),`const {app}=require('electron');const fs=require('node:fs');const {Worker}=require('node:worker_threads');
app.setPath('userData',${JSON.stringify(path.join(copy.root,'fallback-profile'))});
const marker=${JSON.stringify(path.join(copy.root,'fallback-marker.json'))};
app.whenReady().then(async()=>{const worker=new Worker(${JSON.stringify(path.join(preserved,'dist/main/interchange-worker.cjs'))});
 const request=message=>new Promise((resolve,reject)=>{worker.once('message',response=>response.ok?resolve(response.result):reject(Error(response.error)));worker.once('error',reject);worker.postMessage(message);});
 try{const parsed=await request({type:'parse',payload:{text:'BEGIN:VCALENDAR\\r\\nVERSION:2.0\\r\\nBEGIN:VEVENT\\r\\nUID:owned-worker-probe\\r\\nSUMMARY:Owned worker course\\r\\nDTSTART:20261001T130000Z\\r\\nDTEND:20261001T140000Z\\r\\nEND:VEVENT\\r\\nEND:VCALENDAR',options:{zone:'UTC'}}});
  const exported=await request({type:'export',payload:{records:parsed.records,options:{zone:'UTC'}}});
  fs.writeFileSync(marker,JSON.stringify({fallbackExecuted:true,parsed,exported}));await worker.terminate();app.exit(0);
 }catch{await worker.terminate();app.exit(2);}});`,{flag:'wx'});
  if(fallbackKind==='default-archive'){
   await createPackage(fallback,path.join(resources,'default_app.asar'));
   await fs.rename(fallback,path.join(copy.root,'preserved-fallback-source'));
  }
 }
 const positive=await ownedProbe(control,['--no-error-dialogs']);expect(positive.code,positive.diagnostics).toBe(0);expect(positive.signal).toBeNull();
 const marker=JSON.parse(await fs.readFile(path.join(control.root,'fallback-marker.json'),'utf8'));
 expect(marker.fallbackExecuted).toBe(true);expect(marker.parsed.records).toHaveLength(1);expect(marker.parsed.invalid).toBe(0);
 expect(marker.parsed.records[0].title).toBe('Owned worker course');expect(marker.exported).toContain('SUMMARY:Owned worker course');
 const negative=await ownedProbe(restricted,['--no-error-dialogs']);expect(negative.code,negative.diagnostics).toBe(1);expect(negative.signal).toBeNull();
 // The pinned loader exits 1 when no allowed app exists; --no-error-dialogs suppresses its GUI exception text.
 // Require the intact positive start, proven fallback worker, one-byte fuse difference, exact exit and absent marker together.
 expect(await absent(path.join(restricted.root,'fallback-marker.json'))).toBe(true);
 await fs.writeFile(info.outputPath('summary.json'),JSON.stringify({version:restricted.version,packageSha256:restricted.packageSha256,
  fallbackKind,intactCalendarsNormalExit:true,controlFallbackExecuted:true,controlPackagedWorkerParsed:true,controlPackagedWorkerExported:true,workerRunAsNodeDisabled:true,
  restrictedFallbackAbsent:true,controlledMissingArchiveRefusal:true,refusalExitCode:1,normalExit:true,nodeCliInspect:false,
  onlyLoadAppFromAsarEnabledInOwnedCopy:true,otherFusesUnchanged:true,
  scope:'Owned missing-archive pair after intact calendar starts; packaged worker parse/export in a synthetic fallback harness, not native picker/import UI acceptance. Installed/retained app unchanged.'},null,2));
});
