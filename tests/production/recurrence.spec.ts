import { test, expect, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { DateTime } from 'luxon';
import type { CalendarItem, Snapshot, ItemType } from '../../src/shared/model';
import { acceptanceCopy, startDesktop } from './desktop.mjs';

let copy:Awaited<ReturnType<typeof acceptanceCopy>>;
test.beforeAll(async()=>{copy=await acceptanceCopy();});
async function retain(info:TestInfo,observed:Record<string,unknown>){await fs.writeFile(info.outputPath('summary.json'),JSON.stringify({version:copy.version,packageSha256:copy.packageSha256,...observed,normalExit:true,nodeCliInspect:false,scope:'Unreleased source-work package; synthetic local account and real editor/review controls. No main-process evaluation, real account or native file dialogs.'},null,2));}
async function viewport(page:Page){await page.setViewportSize({width:1600,height:1000});}
async function createSeries(page:Page,type:ItemType,title:string,allDay=false){
 await page.getByRole('button',{name:'Add item',exact:true}).first().click();let dialog=page.getByRole('dialog');
 await dialog.getByLabel('Title',{exact:true}).fill(title);await dialog.getByRole('combobox',{name:'Type',exact:true}).selectOption(type);
 if(type==='task'||type==='assignment'){
  await dialog.getByRole('button',{name:'No date',exact:true}).click();await expect(dialog.getByRole('combobox',{name:'Frequency',exact:true})).toHaveCount(0);
  await expect(dialog).toContainText('Add a date to repeat this item');await dialog.getByRole('button',{name:'Deadline',exact:true}).click();
 }
 if(allDay)await dialog.getByRole('button',{name:'All day',exact:true}).click();
 await dialog.getByRole('combobox',{name:'Frequency',exact:true}).selectOption('DAILY');await dialog.getByRole('combobox',{name:'Ends',exact:true}).selectOption('count');await dialog.getByLabel('Occurrences',{exact:true}).fill('3');
 await dialog.getByRole('button',{name:'Add to calendar',exact:true}).click();
 dialog=page.getByRole('dialog',{name:'Review repeating schedule',exact:true});await expect(dialog).toBeVisible();await expect(dialog).toContainText('0 → 3 meetings');
 await dialog.getByRole('button',{name:'Apply schedule',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
 const state=await page.evaluate(()=>window.lime.call<Snapshot>('snapshot'));const value=state.records.find((r):r is CalendarItem=>r.kind==='item'&&r.title===title);expect(value).toBeTruthy();return value!;
}
for(const type of ['class','event','assignment','exam','study','task'] as ItemType[]){
 test(`${type} repetition is saved through actual controls and survives normal restart`,async({},info)=>{
  const profile=path.join(copy.root,`repeating-${type}`);let desktop=await startDesktop(copy,profile);
  try{
   let page=desktop.page;await viewport(page);const title=`Repeating ${type}`;const value=await createSeries(page,type,title);
   expect(value.recurrence?.count).toBe(3);expect(value.recurrence?.frequency).toBe('DAILY');expect(value.timing.mode).toBe(['task','assignment'].includes(type)?'deadline':'timed');
   await expect(page.locator('.calendar-event').filter({hasText:title})).toHaveCount(3);
   await desktop.close();desktop=await startDesktop(copy,profile);page=desktop.page;await viewport(page);
   await expect(page.locator('.calendar-event').filter({hasText:title})).toHaveCount(3);await page.locator('.calendar-event').filter({hasText:title}).first().click();
   await expect(page.getByRole('dialog').getByRole('combobox',{name:'Edit repeating item scope',exact:true})).toHaveValue('one');
   await page.getByRole('dialog').getByRole('combobox',{name:'Edit repeating item scope',exact:true}).selectOption('series');await expect(page.getByRole('dialog').getByRole('combobox',{name:'Frequency',exact:true})).toHaveValue('DAILY');await expect(page.getByRole('dialog').getByLabel('Occurrences',{exact:true})).toHaveValue('3');
   await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();
   if(type==='study'){
    await page.locator('.calendar-event').filter({hasText:title}).first().click();const editor=page.getByRole('dialog');
    await expect(editor.getByRole('combobox',{name:'Edit repeating item scope',exact:true})).toHaveValue('one');
    await editor.getByLabel('Title',{exact:true}).fill('Study at the library');await editor.getByRole('button',{name:'Save changes',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('.calendar-event').filter({hasText:'Study at the library'})).toHaveCount(1);await expect(page.locator('.calendar-event').filter({hasText:title})).toHaveCount(2);
    const state=await page.evaluate(()=>window.lime.call<Snapshot>('snapshot'));expect(state.records.find(r=>r.id===value.id)).toMatchObject({title});expect(state.records.find(r=>r.kind==='exception')).toMatchObject({seriesId:value.id,override:{title:'Study at the library'}});
   }
  }finally{await desktop.close();}
  await retain(info,{itemType:type,createdThroughUI:true,explicitPreviewApplied:true,threeOccurrencesAfterRestart:true,oneAndSeriesScopes:true,studyOccurrenceEditObserved:type==='study'});
 });
}

test('recurring assignment occurrence edits and completion remain isolated when the entire series changes',async({},info)=>{
 const profile=path.join(copy.root,'assignment-occurrence-edit');let desktop=await startDesktop(copy,profile);
 try{
  let page=desktop.page;await viewport(page);const date=(await page.locator('.day-cell.today [data-day]').getAttribute('data-day'))!;
  const source=await createSeries(page,'assignment','Daily assignment');
  await page.locator('.calendar-event').filter({hasText:'Daily assignment'}).first().click();let dialog=page.getByRole('dialog');
  await expect(dialog.getByRole('combobox',{name:'Edit repeating item scope',exact:true})).toHaveValue('one');await dialog.getByLabel('Title',{exact:true}).fill('First assignment only');await dialog.getByRole('button',{name:'Save changes',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.calendar-event').filter({hasText:'First assignment only'})).toHaveCount(1);await expect(page.locator('.calendar-event').filter({hasText:'Daily assignment'})).toHaveCount(2);
  const sidebar=page.getByRole('complementary',{name:'Upcoming tasks for the next 7 days'});await expect(sidebar).toBeVisible();await sidebar.getByRole('button',{name:'Complete First assignment only',exact:true}).click();
  await expect(sidebar.getByRole('button',{name:'Complete First assignment only',exact:true})).toHaveCount(0);await expect(sidebar.getByRole('button',{name:'Complete Daily assignment',exact:true})).toHaveCount(2);
  await page.locator('.calendar-event').filter({hasText:'Daily assignment'}).first().click();dialog=page.getByRole('dialog');await dialog.getByRole('combobox',{name:'Edit repeating item scope',exact:true}).selectOption('series');await dialog.getByLabel('Title',{exact:true}).fill('Updated assignment series');await dialog.getByLabel('Occurrences',{exact:true}).fill('2');await dialog.getByRole('button',{name:'Save changes',exact:true}).click();
  await page.getByRole('dialog',{name:'Review repeating schedule',exact:true}).getByRole('button',{name:'Apply schedule',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.calendar-event').filter({hasText:'First assignment only'})).toHaveCount(1);await expect(page.locator('.calendar-event').filter({hasText:'Updated assignment series'})).toHaveCount(1);
  await desktop.close();desktop=await startDesktop(copy,profile);page=desktop.page;await viewport(page);
  await expect(page.locator('.calendar-event').filter({hasText:'First assignment only'})).toHaveCount(1);await expect(page.locator('.calendar-event').filter({hasText:'Updated assignment series'})).toHaveCount(1);
  const state=await page.evaluate(()=>window.lime.call<Snapshot>('snapshot'));expect(state.records.find(r=>r.id===source.id)).toMatchObject({title:'Updated assignment series',recurrence:{count:2}});expect(state.records.filter(r=>r.kind==='occurrenceState')).toEqual([expect.objectContaining({seriesId:source.id,originalDate:date,status:'completed'})]);
  const next=DateTime.fromISO(date).plus({days:1}).toISODate();await page.locator(`[data-day="${next}"]`).click();await expect(page.locator(`#day-panel-${next}`).getByRole('button',{name:'Complete Updated assignment series',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Open profile',exact:true}).click();await expect(page.getByTestId('lifetime-completions')).toHaveText('1');
 }finally{await desktop.close();}
 await retain(info,{assignmentOccurrenceTitleIsolated:true,completionOnlyOneDate:true,seriesReviewApplied:true,overrideAndCompletionRetained:true,nextOccurrenceOpen:true,lifetimeCountOne:true,restart:true});
});

test('tasks can repeat all day and keep a pattern when changing scheduled item type',async({},info)=>{
 const desktop=await startDesktop(copy,path.join(copy.root,'all-day-task'));
 try{
  const page=desktop.page;await viewport(page);const value=await createSeries(page,'task','All-day recurring task',true);expect(value.timing.mode).toBe('allDay');await expect(page.locator('.calendar-event').filter({hasText:value.title})).toHaveCount(3);
  await page.getByRole('button',{name:'Add item',exact:true}).first().click();const dialog=page.getByRole('dialog');await dialog.getByRole('combobox',{name:'Frequency',exact:true}).selectOption('WEEKLY');await dialog.getByRole('combobox',{name:'Type',exact:true}).selectOption('assignment');await expect(dialog.getByRole('combobox',{name:'Frequency',exact:true})).toHaveValue('WEEKLY');
  await dialog.getByRole('button',{name:'No date',exact:true}).click();await expect(dialog.getByRole('combobox',{name:'Frequency',exact:true})).toHaveCount(0);await dialog.getByLabel('Title',{exact:true}).fill('No-date task fixture');await dialog.getByRole('button',{name:'Add to calendar',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  const state=await page.evaluate(()=>window.lime.call<Snapshot>('snapshot'));expect(state.records.find(r=>r.kind==='item'&&r.title==='No-date task fixture')).toMatchObject({recurrence:null,timing:{mode:'unscheduled'}});
 }finally{await desktop.close();}
 await retain(info,{allDayTaskRecurrence:true,typeChangePreservedFrequency:true,noDateClearedRecurrenceOnSave:true});
});
