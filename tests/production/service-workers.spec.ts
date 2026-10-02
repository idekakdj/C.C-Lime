import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { acceptanceCopy } from './desktop.mjs';
import { ownedProbe } from './fuse-probes';

test('valid custom-protocol worker registers only with its explicit privilege and unregisters cleanly', async ({}, info) => {
  const results = [], identities = []; let version = '';
  for (const enabled of [true, false]) {
    const copy = await acceptanceCopy(), resources = path.join(path.dirname(copy.executable), 'resources');
    if (version) expect(copy.version).toBe(version); version = copy.version;
    if (identities.length) expect(copy.packageSha256).toBe(identities[0].archiveSha256); identities.push(copy.policy);
    await fs.rename(path.join(resources, 'app.asar'), path.join(resources, 'preserved-app.asar'));
    const fallback = path.join(resources, 'app'); await fs.mkdir(fallback);
    await fs.writeFile(path.join(fallback, 'package.json'), JSON.stringify({ name: 'owned-worker-probe', version: '0.0.0', main: 'main.cjs' }), { flag: 'wx' });
    const html = '<!doctype html><script src="/probe.js"></script>';
    const worker = "self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));self.addEventListener('message',e=>e.ports[0].postMessage('owned-valid-worker'));";
    const script = `async function probe(){try{const r=await navigator.serviceWorker.register('/worker.js');await navigator.serviceWorker.ready;const marker=await new Promise(resolve=>{const c=new MessageChannel();c.port1.onmessage=e=>resolve(e.data);r.active.postMessage('probe',[c.port2]);});const removed=await r.unregister();ownedProbe.report({registered:true,marker,removed,remaining:(await navigator.serviceWorker.getRegistrations()).length});}catch(e){ownedProbe.report({registered:false,error:e.message});}}probe();`;
    await fs.writeFile(path.join(fallback, 'preload.cjs'), "const {contextBridge,ipcRenderer}=require('electron');contextBridge.exposeInMainWorld('ownedProbe',{report:value=>ipcRenderer.send('owned:worker',value)});", { flag: 'wx' });
    await fs.writeFile(path.join(fallback, 'main.cjs'), `const {app,BrowserWindow,ipcMain,protocol}=require('electron');const fs=require('node:fs');const path=require('node:path');
protocol.registerSchemesAsPrivileged([{scheme:'owned',privileges:{standard:true,secure:true,supportFetchAPI:true,allowServiceWorkers:${enabled}}}]);app.setPath('userData',${JSON.stringify(path.join(copy.root, 'worker-profile'))});
app.whenReady().then(async()=>{protocol.handle('owned',req=>{const name=new URL(req.url).pathname;const entries={'/index.html':[${JSON.stringify(html)},'text/html'],'/probe.js':[${JSON.stringify(script)},'application/javascript'],'/worker.js':[${JSON.stringify(worker)},'application/javascript']};const entry=entries[name];return new Response(entry?.[0]??'missing',{status:entry?200:404,headers:{'Content-Type':entry?.[1]??'text/plain'}});});
const w=new BrowserWindow({show:false,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,sandbox:true,nodeIntegration:false,webSecurity:true}});ipcMain.once('owned:worker',(event,result)=>{if(event.sender!==w.webContents||event.senderFrame!==w.webContents.mainFrame)app.exit(2);else{fs.writeFileSync(${JSON.stringify(path.join(copy.root, 'worker-result.json'))},JSON.stringify(result));w.destroy();app.quit();}});await w.loadURL('owned://app/index.html');});`, { flag: 'wx' });
    const outcome = await ownedProbe(copy, ['--no-error-dialogs']); expect(outcome.code, outcome.diagnostics).toBe(0); expect(outcome.signal).toBeNull();
    results.push(JSON.parse(await fs.readFile(path.join(copy.root, 'worker-result.json'), 'utf8')));
  }
  expect(results[0]).toEqual({ registered: true, marker: 'owned-valid-worker', removed: true, remaining: 0 });
  expect(results[1].registered).toBe(false); expect(results[1].error).toMatch(/not supported|not allowed|unsupported|scheme/i);
  await fs.writeFile(info.outputPath('summary.json'), JSON.stringify({ version, packageSha256: identities[0].archiveSha256, fixtureIdentities: identities, validWorkerControlSucceeded: true,
    disabledPrivilegeRegistrationRefused: true, controlUnregistered: true, normalExit: true, nodeCliInspect: false,
    scope: 'Owned fallback custom-protocol pair with one privilege changed, valid active worker message and explicit refusal. Actual packaged app registration observation is a separate case; installed app untouched.' }, null, 2));
});
