import { _electron as electron } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
const performance=JSON.parse(await fs.readFile('test-results/performance.json','utf8'));
if(!performance.complete)throw new Error('Complete the large-fixture performance check first.');
const profile=path.resolve(performance.profile);
if(path.dirname(profile)!==path.resolve('test-results')||!path.basename(profile).startsWith('performance-'))throw new Error('Expected the isolated performance profile.');
const app=await electron.launch({executablePath:path.resolve('out/C.C. Lime-win32-x64/cc-lime.exe'),args:[`--cc-lime-test-profile=${profile}`],timeout:60000});
const report={date:new Date().toISOString(),version:performance.version,fixture:performance.fixture,logicalCores:os.cpus().length,complete:false,results:[],note:'Two real five-minute intervals in an isolated packaged local calendar. No cloud polling or active reminder rules in this fixture. CPU is summed across app processes; normalized percent divides by logical cores. Working-set totals may include shared pages.'};
const sample=()=>app.evaluate(({app})=>app.getAppMetrics().map(m=>({pid:m.pid,type:m.type,cpuSeconds:m.cpu.cumulativeCPUUsage,workingSetKiB:m.memory.workingSetSize})));
try{
  const page=await app.firstWindow();await page.getByRole('button',{name:/Explore a local calendar/}).click();await page.locator('.app-shell[data-calendar-ready="true"]').waitFor({timeout:60000});
  for(const mode of ['foreground','tray']){
    if(mode==='tray')await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].hide());
    await new Promise(resolve=>setTimeout(resolve,2000));
    const before=await sample(),started=Date.now();let after=before;
    for(let i=0;i<10;i++){await new Promise(resolve=>setTimeout(resolve,30000));after=await sample();console.log(`${mode} idle: ${(i+1)*30} seconds measured`);}
    const elapsed=(Date.now()-started)/1000;
    if(after.some(m=>typeof m.cpuSeconds!=='number'))throw new Error('CPU totals unavailable on this host.');
    if(before.some(m=>!after.some(n=>n.pid===m.pid)))throw new Error('An app process exited during the interval; repeat the measurement.');
    const cpuSeconds=after.reduce((total,m)=>total+m.cpuSeconds-(before.find(n=>n.pid===m.pid)?.cpuSeconds??0),0);
    report.results.push({mode,elapsedSeconds:elapsed,cpuSeconds,singleCoreEquivalentPercent:100*cpuSeconds/elapsed,normalizedMachinePercent:100*cpuSeconds/elapsed/os.cpus().length,workingSetMiB:after.reduce((n,m)=>n+m.workingSetKiB,0)/1024,processes:after});
    await fs.writeFile('test-results/idle.json',JSON.stringify(report,null,2));
  }
  report.complete=true;await fs.writeFile('test-results/idle.json',JSON.stringify(report,null,2));console.log('Idle evidence saved to test-results/idle.json.');
}finally{await app.close();}
