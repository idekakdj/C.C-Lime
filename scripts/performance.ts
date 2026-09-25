import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { DateTime } from 'luxon';
import { createBackup } from '../src/domain/interchange';
import { courseSchema,makeItem,type DomainRecord } from '../src/shared/model';

const profile=path.resolve('test-results','performance-'+randomUUID());
await fs.mkdir(profile,{recursive:true});
const fixture=path.join(profile,'fixture.json'),from=DateTime.now().startOf('month').toISODate()!;
const records:DomainRecord[]=[];
for(let i=0;i<50;i++)records.push(courseSchema.parse({id:randomUUID(),kind:'course',name:`Subject ${i+1}`,code:`CC${i+1}`}));
for(let i=0;i<5000;i++){
  const date=DateTime.fromISO(from).plus({days:i<500?0:i%31}).toISODate()!;
  const value=makeItem(randomUUID(),date,'America/Toronto',i<500?'class':i%10===0?'assignment':'event');
  value.title=`Plan ${i} ${i===777?'quartz':''}`;value.courseId=records[i%50].id;
  if(i<500)value.recurrence={frequency:'DAILY',interval:1,count:31,until:null,weekdays:[],monthlyMode:'date',ordinal:1,excludedDates:[],extraDates:[]};
  records.push(value);
}
await fs.writeFile(fixture,createBackup('local-preview',records));
const executable=path.resolve('out/C.C. Lime-win32-x64/cc-lime.exe');
let app:ElectronApplication|undefined,page:Page;
const starts:number[]=[],saves:number[]=[],months:number[]=[],days:number[]=[],searches:number[]=[];
const report:any={date:new Date().toISOString(),complete:false,os:os.version(),release:os.release(),cpu:os.cpus()[0].model,logicalCores:os.cpus().length,memoryGiB:os.totalmem()/1024**3,fixture:{courses:50,masters:5000,occurrences:20000,windowStart:from,days:31,generator:'fixed index schedule; only identities randomized'},profile,note:'UI timings include Playwright overhead. Cold start includes explicitly opening the local calendar. Save measures durable acknowledgment, not cloud synchronization.'};
const summary=(values:number[])=>{const sorted=[...values].sort((a,b)=>a-b);return{medianMs:sorted.length?(sorted[Math.floor((sorted.length-1)/2)]+sorted[Math.floor(sorted.length/2)])/2:null,slowestMs:sorted.length?Math.max(...values):null,samples:values};};
async function checkpoint(){Object.assign(report,{coldStart:summary(starts),save:summary(saves),monthNavigation:summary(months),dayExpansion:summary(days),search:summary(searches)});await fs.writeFile('test-results/performance.json',JSON.stringify(report,null,2));}
async function ready(){await page.locator('.app-shell[data-calendar-ready="true"]').waitFor({timeout:60000});if(await page.locator('.verification-banner.error').count())throw new Error('Calendar reported an error during measurement.');}
async function launch(){const start=performance.now();app=await electron.launch({executablePath:executable,args:[`--cc-lime-test-profile=${profile}`],timeout:60000});page=await app.firstWindow();await page.getByRole('button',{name:/Explore a local calendar/}).click();await page.getByRole('heading',{name:'Your calendar',exact:true}).waitFor();await ready();return start;}
try{
  await launch();report.version=await app!.evaluate(({app})=>app.getVersion());
  await page.evaluate(()=>window.lime.call('device',{onboardingDone:true,month:null}));
  await app!.evaluate(({dialog},file)=>{dialog.showOpenDialog=(async()=>({canceled:false,filePaths:[file]}))as any;},fixture);
  let start=performance.now();const preview=await page.evaluate(()=>window.lime.call<any>('restore.preview'));
  await page.evaluate(token=>window.lime.call('restore.commit',{token,mode:'merge'}),preview.token);
  await page.locator('.calendar-event').first().waitFor({timeout:60000});await ready();report.restoreMs=performance.now()-start;
  await app!.close();app=undefined;await checkpoint();
  for(let i=0;i<10;i++){start=await launch();await page.locator('.calendar-event').first().waitFor({timeout:60000});await ready();starts.push(performance.now()-start);console.log(`Cold start ${i+1}: ${Math.round(starts.at(-1)!)} ms`);await checkpoint();if(i<9){await app!.close();app=undefined;}}
  for(let i=0;i<10;i++){
    for(const direction of ['Next period','Previous period']){start=performance.now();await page.getByRole('button',{name:direction}).click();await ready();months.push(performance.now()-start);}
    start=performance.now();await page.locator(`[data-day="${from}"]`).click();await page.locator(`#day-panel-${from}`).waitFor();days.push(performance.now()-start);await page.getByRole('button',{name:'Close expanded day'}).click();
    start=performance.now();await page.getByRole('textbox',{name:'Search your calendar'}).fill('quartz');await ready();await page.locator('.search-results .item-row').first().waitFor({timeout:60000});searches.push(performance.now()-start);await page.getByRole('button',{name:'Clear search'}).click();await ready();
    const value=makeItem(randomUUID(),from,'America/Toronto');value.title='Measured save';start=performance.now();await page.evaluate(value=>window.lime.call('save',value),value);saves.push(performance.now()-start);await page.evaluate(id=>window.lime.call('remove',{id}),value.id);await page.waitForTimeout(150);await ready();
    console.log(`Interaction sample ${i+1}: saved ${Math.round(saves.at(-1)!)} ms, day ${Math.round(days.at(-1)!)} ms, search ${Math.round(searches.at(-1)!)} ms`);await checkpoint();
  }
  report.processMetrics=await app!.evaluate(({app})=>app.getAppMetrics().map(p=>({type:p.type,cpu:p.cpu,memory:p.memory})));
  report.complete=true;await checkpoint();console.log('Performance evidence saved to test-results/performance.json.');
}catch(error){report.error=error instanceof Error?error.message:'Measurement failed.';await checkpoint();throw error;}
finally{await app?.close();}
