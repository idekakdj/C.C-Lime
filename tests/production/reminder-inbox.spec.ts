import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {item} from '../fixtures';
import type {Snapshot} from '../../src/shared/model';
import {rendererCopy,startDesktop} from './desktop.mjs';

test('dismissing inbox reminders removes only the selected row and stays dismissed after reopen and restart',async({},info)=>{
 const copy=await rendererCopy(),profile=path.join(copy.root,'reminder-dismissal');let desktop=await startDesktop(copy,profile);
 try{
  let page=desktop.page;const due=new Date(Date.now()-5*60000).toISOString();
  for(const title of ['Dismissal fixture one','Dismissal fixture two'])await page.evaluate(value=>window.lime.call('save',value),item({title,itemType:'task',timing:{mode:'deadline',date:due.slice(0,10),time:due.slice(11,16),zone:'UTC',anchorTime:'09:00'},reminders:[{id:randomUUID(),minutesBefore:0}]}));
  await page.getByRole('button',{name:'Open reminder inbox',exact:true}).click();
  let dialog=page.getByRole('dialog',{name:'Your reminder inbox'});await expect(dialog.locator('.reminder-entry')).toHaveCount(2);
  await dialog.locator('.reminder-entry').filter({hasText:'Dismissal fixture one'}).getByRole('button',{name:'Dismiss',exact:true}).click();
  await expect(dialog.locator('.reminder-entry')).toHaveCount(1);await expect(dialog.getByRole('button',{name:'Dismissal fixture two',exact:true})).toBeVisible();
  let snapshot=await page.evaluate(()=>window.lime.call<Snapshot>('snapshot'));expect(snapshot.reminders.map(value=>value.title)).toEqual(['Dismissal fixture two']);
  await dialog.getByRole('button',{name:'Close dialog',exact:true}).click();await page.getByRole('button',{name:'Open reminder inbox',exact:true}).click();
  await expect(dialog.locator('.reminder-entry')).toHaveCount(1);
  await desktop.close();desktop=await startDesktop(copy,profile);page=desktop.page;
  await page.getByRole('button',{name:'Open reminder inbox',exact:true}).click();dialog=page.getByRole('dialog',{name:'Your reminder inbox'});
  await expect(dialog.locator('.reminder-entry')).toHaveCount(1);await expect(dialog.getByRole('button',{name:'Dismissal fixture two',exact:true})).toBeVisible();
  await dialog.getByRole('button',{name:'Dismiss',exact:true}).click();await expect(dialog.locator('.reminder-entry')).toHaveCount(0);await expect(dialog.getByText('You’re all caught up.',{exact:true})).toBeVisible();
  await desktop.close();desktop=await startDesktop(copy,profile);page=desktop.page;
  await page.getByRole('button',{name:'Open reminder inbox',exact:true}).click();await expect(page.getByRole('dialog').getByText('You’re all caught up.',{exact:true})).toBeVisible();
  snapshot=await page.evaluate(()=>window.lime.call<Snapshot>('snapshot'));expect(snapshot.reminders).toEqual([]);expect(snapshot.records.filter(record=>record.kind==='item')).toHaveLength(2);
  await fs.writeFile(info.outputPath('summary.json'),JSON.stringify({version:copy.version,fixturePolicy:copy.policy,selectedRowRemoved:true,otherReminderPreserved:true,reopen:true,ordinaryRestarts:2,emptyInbox:true,calendarItemsPreserved:true},null,2));
 }finally{await desktop.close();}
});
