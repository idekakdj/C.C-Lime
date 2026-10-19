import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {acceptanceCopy,startDesktop,type AcceptanceCopy} from './desktop.mjs';
import {fuseSentinel,readElectronFuses} from '../../scripts/native-package-policy.mjs';

async function nodeHarness(copy:AcceptanceCopy){
 const preload=path.join(copy.root,'node-options-preload.cjs'),main=path.join(copy.root,'node-options-main.cjs');
 const sentinel=path.join(copy.root,'preload-marker.json'),result=path.join(copy.root,'node-runtime.json');
 await fs.writeFile(preload,`require('node:fs').writeFileSync(${JSON.stringify(sentinel)},JSON.stringify({preloadRan:true}));`,{flag:'wx'});
 await fs.writeFile(main,`require('node:fs').writeFileSync(${JSON.stringify(result)},JSON.stringify({electron:process.versions.electron,headerSize:require('node:http').maxHeaderSize}));`,{flag:'wx'});
 const env={...process.env};delete env.NODE_EXTRA_CA_CERTS;delete env.ELECTRON_NO_ASAR;
 env.ELECTRON_RUN_AS_NODE='1';env.NODE_OPTIONS=`--require="${preload.replaceAll('\\','/')}" --max-http-header-size=32768`;
 const child=spawn(copy.executable,[main],{env,cwd:copy.root,windowsHide:true,stdio:['ignore','ignore','pipe']});
 let timer:ReturnType<typeof setTimeout>|undefined,diagnostics='';
 child.stderr.on('data',bytes=>{diagnostics+=(bytes.toString().slice(0,4096-diagnostics.length));});
 try{
  const outcome=await new Promise<{code:number|null;signal:NodeJS.Signals|null}>((resolve,reject)=>{
   child.once('error',()=>reject(Error('Owned Node-mode probe failed to spawn')));
   child.once('exit',(code,signal)=>resolve({code,signal}));
   timer=setTimeout(()=>{child.kill();reject(Error('Owned Node-mode probe timed out; forced cleanup is not a passing refusal'));},10000);
  });
  await fs.writeFile(path.join(copy.root,'node-mode-stderr.txt'),diagnostics);
  expect(outcome,diagnostics).toEqual({code:0,signal:null});
  expect(diagnostics).not.toContain('Debugger listening');
  const runtime=JSON.parse(await fs.readFile(result,'utf8'));expect(runtime.electron).toBe('44.4.5');
  let preloadRan=false;try{preloadRan=JSON.parse(await fs.readFile(sentinel,'utf8')).preloadRan===true;}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
  return {preloadRan,headerSize:runtime.headerSize};
 }finally{if(timer)clearTimeout(timer);}
}

test('paired Node-mode control proves disabled NODE_OPTIONS ignores preload and header override while both calendars still start',async({},info)=>{
 const control=await acceptanceCopy(),disabled=await acceptanceCopy();
 const controlBytes=await fs.readFile(control.executable),disabledBytes=await fs.readFile(disabled.executable),baseline=readElectronFuses(disabledBytes);
 expect(readElectronFuses(controlBytes)).toEqual(baseline);expect(baseline.values.runAsNode).toBe(true);expect(baseline.values.nodeOptions).toBe(true);
 const beforeHash=createHash('sha256').update(disabledBytes).digest('hex');
 const offset=disabledBytes.indexOf(fuseSentinel)+fuseSentinel.length+2+2;expect(disabledBytes[offset]).toBe(0x31);disabledBytes[offset]=0x30;
 expect(readElectronFuses(disabledBytes).values).toEqual({...baseline.values,nodeOptions:false});await fs.writeFile(disabled.executable,disabledBytes);
 const first=await nodeHarness(control);expect(first).toEqual({preloadRan:true,headerSize:32768});
 const second=await nodeHarness(disabled);expect(second).toEqual({preloadRan:false,headerSize:16384});
 for(const copy of [control,disabled]){const desktop=await startDesktop(copy,path.join(copy.root,'calendar-profile'));try{await expect(desktop.page.getByRole('heading',{name:'Your calendar',exact:true})).toBeVisible();}finally{await desktop.close();}}
 expect(createHash('sha256').update(await fs.readFile(control.executable)).digest('hex')).toBe(createHash('sha256').update(controlBytes).digest('hex'));
 await fs.writeFile(info.outputPath('summary.json'),JSON.stringify({version:disabled.version,packageSha256:disabled.packageSha256,
  controlPreloadExecuted:true,controlHeaderSize:32768,disabledPreloadAbsent:true,disabledHeaderSize:16384,
  nodeHarnessNormalExit:true,bothCalendarsNormalExit:true,normalExit:true,nodeCliInspect:false,nodeOptionsDisabledInOwnedCopy:true,otherFusesUnchanged:true,
  originalCopyExecutableSha256:beforeHash,disabledCopyExecutableSha256:createHash('sha256').update(disabledBytes).digest('hex'),
  scope:'Disposable Node-mode pair with runAsNode still enabled; packaged GUI preload restrictions are separate. Installed/retained app unchanged; no production fuse or complete NODE_EXTRA_CA_CERTS coverage claimed.'},null,2));
});
