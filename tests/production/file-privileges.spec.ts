import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import {acceptanceCopy,startDesktop} from './desktop.mjs';
import {absent,ownedProbe,setOwnedFuse} from './fuse-probes';

test('file privilege control fetches a local asset while the disabled copy refuses it and the cclime calendar still recovers from 404',async({},info)=>{
 const control=await acceptanceCopy(),restricted=await acceptanceCopy();
 const mutation=await setOwnedFuse(restricted,'grantFileProtocolExtraPrivileges',false);expect(mutation.before.grantFileProtocolExtraPrivileges).toBe(true);
 for(const copy of [control,restricted]){
  const desktop=await startDesktop(copy,path.join(copy.root,'calendar-profile'));
  try{
   const response=await desktop.page.goto('cclime://app/owned-file-privileges-missing');expect(response?.status()).toBe(404);
   await expect(desktop.page.getByRole('heading',{name:'Page not found',exact:true})).toBeVisible();
   await expect(desktop.page.evaluate(()=>window.lime.call('snapshot'))).rejects.toThrow('Invalid sender');
   await desktop.page.getByRole('link',{name:'Return to calendar',exact:true}).click();
   await expect(desktop.page.getByRole('heading',{name:'Your calendar',exact:true})).toBeVisible();
  }finally{await desktop.close();}
  const resources=path.join(path.dirname(copy.executable),'resources'),archive=path.join(resources,'app.asar'),preserved=path.join(resources,'preserved-app.asar');
  expect(await absent(preserved)).toBe(true);await fs.rename(archive,preserved);
  const fallback=path.join(resources,'app');await fs.mkdir(fallback);
  await fs.writeFile(path.join(fallback,'package.json'),JSON.stringify({name:'owned-file-privilege-probe',version:'0.0.0',main:'main.cjs'}),{flag:'wx'});
  await fs.writeFile(path.join(fallback,'asset.txt'),'owned local asset',{flag:'wx'});
  await fs.writeFile(path.join(fallback,'preload.cjs'),`const {contextBridge,ipcRenderer}=require('electron');contextBridge.exposeInMainWorld('ownedProbe',{report:value=>ipcRenderer.send('owned:file-result',value)});`,{flag:'wx'});
  await fs.writeFile(path.join(fallback,'index.html'),`<!doctype html><script>fetch('./asset.txt').then(async r=>ownedProbe.report({fetched:r.ok,text:await r.text()})).catch(()=>ownedProbe.report({fetched:false}));</script>`,{flag:'wx'});
  await fs.writeFile(path.join(fallback,'main.cjs'),`const {app,BrowserWindow,ipcMain}=require('electron');const fs=require('node:fs');const path=require('node:path');
app.setPath('userData',${JSON.stringify(path.join(copy.root,'file-probe-profile'))});
app.whenReady().then(async()=>{const window=new BrowserWindow({show:false,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,sandbox:true,nodeIntegration:false,webSecurity:true}});
ipcMain.once('owned:file-result',(event,result)=>{if(event.sender!==window.webContents||event.senderFrame!==window.webContents.mainFrame)app.exit(2);
else {fs.writeFileSync(${JSON.stringify(path.join(copy.root,'file-result.json'))},JSON.stringify(result));window.destroy();app.quit();}});
await window.loadFile(path.join(__dirname,'index.html'));});`,{flag:'wx'});
 }
 const results=[];
 for(const copy of [control,restricted]){
  const result=await ownedProbe(copy,['--no-error-dialogs']);expect(result.code,result.diagnostics).toBe(0);expect(result.signal).toBeNull();
  results.push(JSON.parse(await fs.readFile(path.join(copy.root,'file-result.json'),'utf8')));
 }
 expect(results[0]).toEqual({fetched:true,text:'owned local asset'});expect(results[1]).toEqual({fetched:false});
 await fs.writeFile(info.outputPath('summary.json'),JSON.stringify({version:restricted.version,packageSha256:restricted.packageSha256,
  fileFetchControlSucceeded:true,restrictedFileFetchRefused:true,intactCclimeCalendarAnd404Passed:true,missingPageSenderDenied:true,
  normalExit:true,nodeCliInspect:false,filePrivilegesDisabledInOwnedCopy:true,otherFusesUnchanged:true,
  scope:'Owned file-fetch pair plus actual custom-protocol calendar/404 and sender checks. Service-worker and child-frame file privilege surfaces remain separate; installed/retained app unchanged.'},null,2));
});
