import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { LocalStore } from '../../src/main/store';
import { item } from '../fixtures';
import { rendererCopy, startDesktop } from './desktop.mjs';
import type { Snapshot } from '../../src/shared/model';
import { randomUUID } from 'node:crypto';
import { recurrence } from '../fixtures';
let copy:Awaited<ReturnType<typeof rendererCopy>>;
test.beforeAll(async()=>{copy=await rendererCopy();});

test('hostile event and profile text remains literal across real renderer controls and restart',async({},info)=>{
 const profile=path.join(copy.root,'hostile-text');let desktop=await startDesktop(copy,profile);
 const hostile='<img src=x onerror="window.pwned=1">';
 try {
  let page=desktop.page;
  await page.getByRole('button',{name:'Add item',exact:true}).first().click();
  await page.getByRole('dialog').getByLabel('Title',{exact:true}).fill(hostile);
  await page.getByRole('dialog').getByText('Details & reminders',{exact:true}).click();
  await page.getByRole('dialog').getByLabel('Notes',{exact:true}).fill('<script>window.pwned=2</script> javascript:alert(1)');
  await page.getByRole('dialog').getByRole('button',{name:'Add to calendar'}).click();
  await expect(page.locator('.calendar-event').filter({hasText:hostile}).first()).toBeVisible();
  await page.getByRole('button',{name:'Open profile',exact:true}).click();
  await page.getByLabel('Username',{exact:true}).fill(hostile);await page.getByRole('button',{name:'Save profile',exact:true}).click();
  await expect(page.locator('.profile-hero')).toContainText(hostile);
  await page.screenshot({path:info.outputPath('literal-profile-text.png')});
  expect(await page.evaluate(()=>({pwned:(window as any).pwned,node:typeof(window as any).require,storage:Object.keys(localStorage),images:document.querySelectorAll('img[src="x"]').length}))).toEqual({pwned:undefined,node:'undefined',storage:[],images:0});
  await desktop.close();desktop=await startDesktop(copy,profile);page=desktop.page;
  await expect(page.locator('.calendar-event').filter({hasText:hostile}).first()).toBeVisible();
  expect(await page.evaluate(()=>(window as any).pwned)).toBeUndefined();
 } finally {await desktop.close();}
 await fs.writeFile(info.outputPath('summary.json'),JSON.stringify({fixturePolicy:copy.policy,hostileTextLiteral:true,restart:true,normalExit:true},null,2));
});

test('malformed bridge payloads fail without changing stored records or breaking subsequent valid requests',async({},info)=>{
 const desktop=await startDesktop(copy,path.join(copy.root,'bridge-corpus'));
 try {
  const page=desktop.page,before=await page.evaluate(()=>window.lime.call<Snapshot>('snapshot'));
  const results=await page.evaluate(async()=>{
   const cycle:any={};cycle.self=cycle;
   const corpus:Array<[any,any]>=[['save',null],['save',{id:'../../escape',kind:'item'}],['device',{notifications:'yes'}],['profile.save',{name:'valid',extra:'forbidden'}],['profile.photo.save',{token:'invalid',adjustment:{zoom:Infinity,x:0,y:0}}],['appearance',{active:'purple',custom:Array.from({length:4},()=>({}))}],['snapshot',cycle],['snapshot',{value:1n}],['snapshot',{padding:'x'.repeat(1024*1024+1)}],['x'.repeat(65),{}],['unknown.command',{}]];
   return await Promise.all(corpus.map(async([command,payload])=>{try{await window.lime.call(command,payload);return {rejected:false};}catch(error){return {rejected:true,error:(error as Error).message};}}));
  });
  expect(results.every(r=>r.rejected)).toBe(true);
  const after=await page.evaluate(()=>window.lime.call<Snapshot>('snapshot'));expect(after.records).toEqual(before.records);
  const good=item({title:'Valid after hostile requests',timing:{mode:'unscheduled',zone:'UTC'}});
  await page.evaluate(record=>window.lime.call('save',record),good);
  expect((await page.evaluate(()=>window.lime.call<Snapshot>('snapshot'))).records.some(r=>r.id===good.id)).toBe(true);
  await fs.writeFile(info.outputPath('summary.json'),JSON.stringify({fixturePolicy:copy.policy,rejections:results.length,noPartialWrites:true,validRequestAfterwards:true},null,2));
 } finally {await desktop.close();}
});

test('legacy invalid clock times leave the calendar usable and expose an actual repair control',async({},info)=>{
 const profile=path.join(copy.root,'legacy-gap');
 const bad=item({title:'Legacy impossible deadline',itemType:'task',timing:{mode:'deadline',date:'2026-03-08',time:'02:30',zone:'America/Toronto',anchorTime:'09:00'}});
 // Seed only the explicitly owned closed test database, bypassing new-write
 // validation to reproduce an older saved or remotely hydrated record.
 const store=new LocalStore(profile,'local-preview');
 store.db.prepare('INSERT INTO records(id,kind,payload) VALUES (?,?,?)').run(bad.id,bad.kind,JSON.stringify(bad));store.close();
 const desktop=await startDesktop(copy,profile);
 try {
  const page=desktop.page;
  await expect(page.getByRole('alert').filter({hasText:'Some saved items'})).toBeVisible();
  await page.getByRole('button',{name:'Edit Legacy impossible deadline',exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('dialog').getByLabel('Due time (optional)',{exact:true}).fill('03:30');
  await page.getByRole('dialog').getByRole('button',{name:'Save changes'}).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('alert').filter({hasText:'Some saved items'})).toHaveCount(0);
  expect((await page.evaluate(()=>window.lime.call<Snapshot>('snapshot'))).records.find(r=>r.id===bad.id)).toMatchObject({timing:{time:'03:30'}});
  await fs.writeFile(info.outputPath('summary.json'),JSON.stringify({fixturePolicy:copy.policy,legacyCalendarUsable:true,repairThroughRenderer:true},null,2));
 } finally {await desktop.close();}
});
test('an invalid legacy occurrence override can be repaired without changing the parent or siblings',async({},info)=>{
 const profile=path.join(copy.root,'legacy-override'),parent=item({title:'Valid master',timing:{mode:'timed',start:'2026-03-07T14:00:00Z',end:'2026-03-07T15:00:00Z',zone:'America/Toronto'},recurrence:recurrence({frequency:'DAILY',weekdays:[],count:3})});
 const bad={id:randomUUID(),kind:'exception',seriesId:parent.id,originalDate:'2026-03-08',cancelled:false,override:{title:'Legacy impossible override',timing:{mode:'deadline',date:'2026-03-08',time:'02:30',zone:'America/Toronto',anchorTime:'09:00'}}};
 const store=new LocalStore(profile,'local-preview');store.save(parent);store.db.prepare('INSERT INTO records(id,kind,payload) VALUES (?,?,?)').run(bad.id,bad.kind,JSON.stringify(bad));store.close();
 const desktop=await startDesktop(copy,profile);
 try {
  const page=desktop.page;await page.getByRole('button',{name:'Edit Legacy impossible override',exact:true}).click();
  await page.getByRole('dialog').getByLabel('Due time (optional)',{exact:true}).fill('03:30');await page.getByRole('dialog').getByRole('button',{name:'Save changes'}).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();await expect(page.getByRole('alert').filter({hasText:'Some saved items'})).toHaveCount(0);
  const snapshot=await page.evaluate(()=>window.lime.call<Snapshot>('snapshot'));expect(snapshot.records.find(r=>r.id===parent.id)).toEqual(parent);expect(snapshot.records.find(r=>r.id===bad.id)).toMatchObject({override:{timing:{time:'03:30'}}});
  await fs.writeFile(info.outputPath('summary.json'),JSON.stringify({fixturePolicy:copy.policy,legacyOverrideRepair:true,parentUnchanged:true},null,2));
 } finally {await desktop.close();}
});
