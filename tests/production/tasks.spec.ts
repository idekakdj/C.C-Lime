import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { makeItem, type Snapshot } from '../../src/shared/model';
import { acceptanceCopy, startDesktop } from './desktop.mjs';

test('sidebar completion and undo preserve a single lifetime completion after deletion and normal restart',async({},testInfo)=>{
 const copy=await acceptanceCopy(),profile=path.join(copy.root,'task-progress');let desktop=await startDesktop(copy,profile);
 try{
  let page=desktop.page;const date=await page.locator('.day-cell.today [data-day]').getAttribute('data-day');expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  const state=await page.evaluate(()=>window.lime.call<Snapshot>('snapshot')),value=makeItem(randomUUID(),date!,state.displayZone??'America/Toronto','task');value.title='Independent lifetime task';value.timing={mode:'deadline',date:date!,time:null,zone:state.displayZone??'America/Toronto',anchorTime:'09:00'};
  await page.evaluate(task=>window.lime.call('save',task),value);
  const sidebar=page.getByRole('complementary',{name:'Upcoming tasks for the next 7 days'}),complete=sidebar.getByRole('button',{name:'Complete Independent lifetime task',exact:true});
  await expect(complete).toBeVisible();await complete.click();await expect(complete).not.toBeVisible();await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(complete).toBeVisible();
  await page.getByRole('button',{name:'Open profile',exact:true}).click();await expect(page.getByTestId('lifetime-completions')).toHaveText('1');
  await page.getByRole('button',{name:'Calendar',exact:true}).click();await complete.click();await expect(complete).not.toBeVisible();
  await page.evaluate(id=>window.lime.call('remove',{id}),value.id);await page.getByRole('button',{name:'Open profile',exact:true}).click();await expect(page.getByTestId('lifetime-completions')).toHaveText('1');
  await desktop.close();desktop=await startDesktop(copy,profile);page=desktop.page;
  await expect(page.getByRole('button',{name:'Complete Independent lifetime task',exact:true})).toHaveCount(0);await expect(page.locator('.calendar-event').filter({hasText:value.title})).toHaveCount(0);
  await page.getByRole('button',{name:'Open profile',exact:true}).click();await expect(page.getByTestId('lifetime-completions')).toHaveText('1');
  const after=await page.evaluate(()=>window.lime.call<Snapshot>('snapshot'));expect(after.records.some(record=>record.id===value.id)).toBe(false);expect(after.records.filter(record=>record.kind==='completion')).toHaveLength(1);
 }finally{await desktop.close();}
 await fs.writeFile(testInfo.outputPath('summary.json'),JSON.stringify({version:copy.version,sidebarCompleted:true,undoRestoredTask:true,lifetimeCountStayedOne:true,deletionAndRestartPreservedHistory:true,normalExit:true,nodeCliInspect:false,scope:'Synthetic local profile; ordinary renderer bridge and UI only. No native dialog, owner account or main-process evaluation.'},null,2));
});
