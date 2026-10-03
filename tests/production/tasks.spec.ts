import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { makeItem, type Snapshot } from '../../src/shared/model';
import { rendererCopy, startDesktop } from './desktop.mjs';

test('sidebar completion and undo preserve a single lifetime completion after deletion and normal restart',async({},testInfo)=>{
 const copy=await rendererCopy(),profile=path.join(copy.root,'task-progress');let desktop=await startDesktop(copy,profile);
 try{
  let page=desktop.page;await page.setViewportSize({width:1100,height:850});await expect.poll(()=>page.evaluate(()=>window.innerWidth)).toBe(1100);
  async function openUpcoming(){const toggle=page.getByRole('button',{name:'Show upcoming tasks',exact:true});if(await toggle.isVisible())await toggle.click();await expect(page.getByRole('complementary',{name:'Upcoming tasks for the next 7 days'})).toBeVisible();}
  async function closeUpcoming(){const close=page.getByRole('button',{name:'Close upcoming tasks',exact:true}).last();if(await close.isVisible())await close.click();}
  const date=await page.locator('.day-cell.today [data-day]').getAttribute('data-day');expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  const state=await page.evaluate(()=>window.lime.call<Snapshot>('snapshot')),value=makeItem(randomUUID(),date!,state.displayZone??'America/Toronto','task');value.title='Independent lifetime task';value.timing={mode:'deadline',date:date!,time:null,zone:state.displayZone??'America/Toronto',anchorTime:'09:00'};
  await page.evaluate(task=>window.lime.call('save',task),value);
  const sidebar=page.getByRole('complementary',{name:'Upcoming tasks for the next 7 days'}),complete=sidebar.getByRole('button',{name:'Complete Independent lifetime task',exact:true});
  await openUpcoming();await expect(complete).toBeVisible();await complete.click();await expect(complete).not.toBeVisible();await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(complete).toBeVisible();await closeUpcoming();
  await page.getByRole('button',{name:'Open profile',exact:true}).click();await expect(page.getByTestId('lifetime-completions')).toHaveText('1');
  await page.getByRole('button',{name:'Calendar',exact:true}).click();await openUpcoming();await complete.click();await expect(complete).not.toBeVisible();await closeUpcoming();
  await page.evaluate(id=>window.lime.call('remove',{id}),value.id);await page.getByRole('button',{name:'Open profile',exact:true}).click();await expect(page.getByTestId('lifetime-completions')).toHaveText('1');
  await desktop.close();desktop=await startDesktop(copy,profile);page=desktop.page;
  await page.setViewportSize({width:1100,height:850});await openUpcoming();await expect(page.getByRole('button',{name:'Complete Independent lifetime task',exact:true})).toHaveCount(0);await closeUpcoming();await expect(page.locator('.calendar-event').filter({hasText:value.title})).toHaveCount(0);
  await page.getByRole('button',{name:'Open profile',exact:true}).click();await expect(page.getByTestId('lifetime-completions')).toHaveText('1');
  const after=await page.evaluate(()=>window.lime.call<Snapshot>('snapshot'));expect(after.records.some(record=>record.id===value.id)).toBe(false);expect(after.records.filter(record=>record.kind==='completion')).toHaveLength(1);
 }finally{await desktop.close();}
 await fs.writeFile(testInfo.outputPath('summary.json'),JSON.stringify({version:copy.version,packageSha256:copy.packageSha256,fixturePolicy:copy.policy,sidebarCompleted:true,undoRestoredTask:true,lifetimeCountStayedOne:true,deletionAndRestartPreservedHistory:true,normalExit:true,nodeCliInspect:false,scope:'Synthetic local profile; ordinary renderer bridge and UI only. No native dialog, owner account or main-process evaluation.'},null,2));
});
