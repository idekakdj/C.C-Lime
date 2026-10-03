import { test, expect, type TestInfo } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { DateTime } from 'luxon';
import AxeBuilder from '@axe-core/playwright';
import { makeItem, type Snapshot } from '../../src/shared/model';
import { rendererCopy, startDesktop } from './desktop.mjs';

let copy:Awaited<ReturnType<typeof rendererCopy>>;
test.beforeAll(async()=>{copy=await rendererCopy();});
async function summary(info:TestInfo,observed:Record<string,unknown>){await fs.writeFile(info.outputPath('summary.json'),JSON.stringify({version:copy.version,packageSha256:copy.packageSha256,fixturePolicy:copy.policy,...observed,normalExit:true,nodeCliInspect:false,scope:'Unreleased source-work package; synthetic local tasks, real completion/range controls and ordinary bridge. No owner data, native dialogs or main-process evaluation.'},null,2));}

test('old and undated completions remain visible despite calendar hiding and contribute to durable weekly progress',async({},info)=>{
 const profile=path.join(copy.root,'completed-ranges');let desktop=await startDesktop(copy,profile);
 try{
  let page=desktop.page;await page.setViewportSize({width:1600,height:1000});const date=(await page.locator('.day-cell.today [data-day]').getAttribute('data-day'))!,state=await page.evaluate(()=>window.lime.call<Snapshot>('snapshot')),zone=state.displayZone!;
  const old=makeItem(randomUUID(),date,zone,'task');old.title='Older task completed now';old.timing={mode:'deadline',date:DateTime.fromISO(date).minus({days:45}).toISODate()!,time:null,zone,anchorTime:'09:00'};
  const undated=makeItem(randomUUID(),date,zone,'task');undated.title='Undated task completed now';undated.timing={mode:'unscheduled',zone};
  const repeating={...old,id:randomUUID(),title:'Older recurring task completed now',recurrence:{frequency:'DAILY' as const,interval:1,count:2,until:null,weekdays:[],monthlyMode:'date' as const,ordinal:1,excludedDates:[],extraDates:[]}};
  await page.evaluate(async values=>{for(const value of values)await window.lime.call('save',value);},[old,undated,repeating]);
  await page.getByLabel('Hide completed',{exact:true}).click();await expect(page.getByLabel('Hide completed',{exact:true})).toBeChecked();await page.getByRole('button',{name:'My tasks',exact:true}).click();
  await page.getByRole('button',{name:`Complete ${old.title}`,exact:true}).click();
  const saved=await page.evaluate(()=>window.lime.call<Snapshot>('snapshot'));expect(saved.records.find(r=>r.id===old.id)).toMatchObject({status:'completed',completedAt:expect.any(String)});
  await page.getByRole('button',{name:'Completed',exact:true}).click();await expect(page.getByText(old.title,{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Calendar',exact:true}).click();const progress=page.getByRole('progressbar',{name:'Weekly task progress',exact:true});await expect(progress).toHaveAttribute('aria-valuenow','1');await expect(progress).toHaveAttribute('aria-valuemax','2');
  await page.getByRole('button',{name:'My tasks',exact:true}).click();await page.getByRole('button',{name:'To do',exact:true}).click();await page.getByRole('button',{name:`Complete ${undated.title}`,exact:true}).click();await page.getByRole('button',{name:'Completed',exact:true}).click();await expect(page.locator('.tasks-page .item-row')).toHaveCount(2);
  await page.getByRole('button',{name:'Calendar',exact:true}).click();await expect(progress).toHaveAttribute('aria-valuenow','2');await expect(progress).toHaveAttribute('aria-valuemax','2');
  await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(progress).toHaveAttribute('aria-valuenow','1');
  await page.getByRole('button',{name:'My tasks',exact:true}).click();await page.getByRole('button',{name:'To do',exact:true}).click();await page.getByRole('button',{name:`Complete ${undated.title}`,exact:true}).click();
  await page.getByRole('button',{name:`Complete ${repeating.title}`,exact:true}).first().click();
  const withRepeat=await page.evaluate(()=>window.lime.call<Snapshot>('snapshot'));expect(withRepeat.records.filter(r=>r.kind==='occurrenceState')).toEqual([expect.objectContaining({seriesId:repeating.id,status:'completed'})]);
  await desktop.close();desktop=await startDesktop(copy,profile);page=desktop.page;await page.setViewportSize({width:1600,height:1000});
  await expect(page.getByLabel('Hide completed',{exact:true})).toBeChecked();await expect(page.getByRole('progressbar',{name:'Weekly task progress',exact:true})).toHaveAttribute('aria-valuenow','3');
  await page.getByRole('button',{name:'My tasks',exact:true}).click();await page.getByRole('button',{name:'Completed',exact:true}).click();await expect(page.locator('.tasks-page .item-row')).toHaveCount(3);await expect(page.getByText(old.title,{exact:true})).toBeVisible();await expect(page.getByText(undated.title,{exact:true})).toBeVisible();await expect(page.getByText(repeating.title,{exact:true})).toBeVisible();
  await page.screenshot({path:info.outputPath('saved-completed-tasks.png')});
 }finally{await desktop.close();}
 await summary(info,{olderCompletionPersisted:true,historicalRepeatingCompletion:true,completedUnaffectedByCalendarHiding:true,undatedProgress:true,undoAndRecompletion:true,completedAndWeeklyRestart:true});
});

test('to-do ranges include current week, current month and all saved standalone dates without losing undated tasks',async({},info)=>{
 const desktop=await startDesktop(copy,path.join(copy.root,'todo-range-options'));
 try{
  const page=desktop.page;await page.setViewportSize({width:1600,height:1000});const today=(await page.locator('.day-cell.today [data-day]').getAttribute('data-day'))!,state=await page.evaluate(()=>window.lime.call<Snapshot>('snapshot')),zone=state.displayZone!;
  const now=DateTime.fromISO(today),start=now.minus({days:(now.weekday-1+7)%7}),end=start.plus({days:7});
  const monthOnly=Array.from({length:now.daysInMonth!},(_,i)=>now.startOf('month').plus({days:i})).find(d=>d<start||d>=end)!;
  const dates=[today,monthOnly.toISODate()!,now.plus({months:1}).set({day:15}).toISODate()!,now.plus({years:1}).toISODate()!];
  const values=dates.map((date,i)=>{const value=makeItem(randomUUID(),date,zone,'task');value.title=['Week range task','Month range task','Other month task','Far future task'][i];value.timing={mode:'deadline',date,time:null,zone,anchorTime:'09:00'};return value;});
  const noDate=makeItem(randomUUID(),today,zone,'task');noDate.title='No date in every range';noDate.timing={mode:'unscheduled',zone};
  const ongoing=makeItem(randomUUID(),today,zone,'task');ongoing.title='Ongoing multi-day task';ongoing.timing={mode:'allDay',startDate:now.minus({days:1}).toISODate()!,endDate:now.plus({days:2}).toISODate()!,zone,anchorTime:'09:00'};
  await page.evaluate(async tasks=>{for(const task of tasks)await window.lime.call('save',task);},[...values,noDate,ongoing]);await page.getByRole('button',{name:/^My tasks(?:\s+\d+)?$/}).click();const range=page.getByRole('combobox',{name:'Task range',exact:true});await expect(range).toHaveValue('all');
  await expect(page.locator('.tasks-page .item-row')).toHaveCount(6);await expect(page.getByText('Far future task',{exact:true})).toBeVisible();await expect(page.getByText(ongoing.title,{exact:true})).toBeVisible();
  await range.selectOption('week');await expect(page.locator('.tasks-page .item-row')).toHaveCount(3);await expect(page.getByText('Week range task',{exact:true})).toBeVisible();await expect(page.getByText(noDate.title,{exact:true})).toBeVisible();
  await range.selectOption('month');await expect(page.locator('.tasks-page .item-row')).toHaveCount(4);await expect(page.getByText('Month range task',{exact:true})).toBeVisible();await expect(page.getByText('Other month task',{exact:true})).toHaveCount(0);
  await range.selectOption('all');await expect(page.locator('.tasks-page .item-row')).toHaveCount(6);await expect(page.getByText('Far future task',{exact:true})).toBeVisible();
  await page.setViewportSize({width:800,height:850});await expect(range).toBeVisible();await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  expect((await new AxeBuilder({page}).setLegacyMode().withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
  await page.screenshot({path:info.outputPath('task-range-controls.png')});
 }catch(error){
  await fs.writeFile(info.outputPath('renderer-failure.json'),JSON.stringify({width:await desktop.page.evaluate(()=>innerWidth),loading:await desktop.page.locator('.loading-screen').allTextContents(),errors:await desktop.page.locator('.verification-banner.error').allTextContents(),navigationVisible:await desktop.page.getByRole('button',{name:'Open navigation',exact:true}).isVisible()},null,2));
  await desktop.page.screenshot({path:info.outputPath('renderer-failure.png')});throw error;
 }finally{await desktop.close();}
 await summary(info,{currentWeek:true,currentMonth:true,allStandaloneDates:true,farFutureReachable:true,undatedInEveryRange:true,ongoingSpanReachable:true,measuredNarrowNoOverflow:true,automatedAccessibility:true});
});
