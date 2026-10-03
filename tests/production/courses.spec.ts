import { test, expect, type Page, type TestInfo } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { makeItem, type Course, type Snapshot } from '../../src/shared/model';
import { rendererCopy, startDesktop } from './desktop.mjs';

let copy:Awaited<ReturnType<typeof rendererCopy>>;
test.beforeAll(async()=>{copy=await rendererCopy();});
async function createCourse(page:Page){
 await page.getByRole('button',{name:'Add course',exact:true}).click();
 await page.getByLabel('Course name',{exact:true}).fill('Independent course');await page.getByLabel('Course code',{exact:true}).fill('PP103');
 await page.getByRole('button',{name:'Save course',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
 const state=await page.evaluate(()=>window.lime.call<Snapshot>('snapshot'));
 return state.records.find((record):record is Course=>record.kind==='course'&&record.code==='PP103')!;
}
async function retain(info:TestInfo,assertions:Record<string,unknown>){await fs.writeFile(info.outputPath('summary.json'),JSON.stringify({version:copy.version,packageSha256:copy.packageSha256,fixturePolicy:copy.policy,...assertions,normalExit:true,nodeCliInspect:false,scope:'Synthetic local profile; real renderer controls/mouse and ordinary bridge only. No native popup painting, file dialogs, cloud account or main-process inspection.'},null,2));}
async function accessible(page:Page){expect((await new AxeBuilder({page}).setLegacyMode().withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations.map(value=>({id:value.id,nodes:value.nodes.map(node=>({target:node.target,summary:node.failureSummary}))})),`Appearance: ${await page.locator('html').getAttribute('data-appearance')}`).toEqual([]);}

test('edits a course from calendar navigation and its card without duplicating or losing linked items after restart',async({},info)=>{
 const profile=path.join(copy.root,'course-edit');let desktop=await startDesktop(copy,profile);
 try{
  let page=desktop.page;await page.setViewportSize({width:1600,height:1000});await expect.poll(()=>page.evaluate(()=>window.innerWidth)).toBe(1600);
  const course=await createCourse(page);expect(course).toBeTruthy();const state=await page.evaluate(()=>window.lime.call<Snapshot>('snapshot')),date=await page.locator('.day-cell.today [data-day]').getAttribute('data-day');
  const item=makeItem(randomUUID(),date!,state.displayZone!,'event');item.title='Linked course fixture';item.courseId=course.id;await page.evaluate(value=>window.lime.call('save',value),item);
  await page.getByRole('button',{name:'Edit course PP103',exact:true}).click();await expect(page.getByRole('dialog',{name:'Edit course'})).toBeVisible();
  await page.getByLabel('Course name',{exact:true}).fill('Updated course');await page.getByLabel('Course code',{exact:true}).fill('PP104');await page.getByLabel('Instructor',{exact:true}).fill('Updated instructor');await page.getByRole('button',{name:'Save course',exact:true}).click();
  await expect(page.getByRole('button',{name:'Edit course PP104',exact:true})).toBeVisible();await expect(page.getByRole('combobox',{name:'Filter calendar by course'}).locator('option').filter({hasText:'PP104'})).toHaveCount(1);
  await page.getByRole('button',{name:'Edit course PP104',exact:true}).click();await page.getByLabel('Course name',{exact:true}).fill('Discarded course');await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await page.getByRole('button',{name:'Courses & semesters',exact:true}).click();const card=page.locator('.course-cards').getByRole('button',{name:'Edit course PP104',exact:true});await expect(card).toContainText('Edit course');await card.click();
  await expect(page.getByLabel('Course name',{exact:true})).toHaveValue('Updated course');await page.getByLabel('Usual location',{exact:true}).fill('Room 204');await page.getByLabel('Archive this course (keep its calendar items)',{exact:true}).check();await page.getByRole('button',{name:'Save course',exact:true}).click();
  await expect(card).toHaveCount(0);await page.getByLabel('Include archived',{exact:true}).check();await card.click();await page.getByLabel('Archive this course (keep its calendar items)',{exact:true}).uncheck();await page.getByRole('button',{name:'Save course',exact:true}).click();
  await accessible(page);await page.screenshot({path:info.outputPath('course-edit-controls.png')});
  await desktop.close();desktop=await startDesktop(copy,profile);page=desktop.page;
  const after=await page.evaluate(()=>window.lime.call<Snapshot>('snapshot'));expect(after.records.filter(record=>record.kind==='course')).toHaveLength(1);expect(after.records.find(record=>record.id===course.id)).toMatchObject({name:'Updated course',code:'PP104',instructor:'Updated instructor',location:'Room 204',archived:false});expect(after.records.find(record=>record.id===item.id)).toMatchObject({courseId:course.id,title:item.title});
  await page.getByRole('combobox',{name:'Filter calendar by course'}).selectOption(course.id);await expect(page.locator('.calendar-event').filter({hasText:item.title})).toBeVisible();
 }finally{await desktop.close();}
 await retain(info,{sidebarAndCardEdit:true,cancelPreservedCourse:true,archiveEditRestore:true,sameCourseAndLinkedItemIds:true,restart:true,automatedAccessibility:true});
});

test('keeps a course draft when a selection drag ends outside and still allows genuine backdrop, Escape and close dismissal',async({},info)=>{
 const desktop=await startDesktop(copy,path.join(copy.root,'course-selection'));
 try{
  const page=desktop.page;await page.setViewportSize({width:1100,height:900});
  await page.getByRole('button',{name:'Add course',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Add a course'}),name=page.getByLabel('Course name',{exact:true});await name.fill('Selection draft must stay');
  const field=await name.boundingBox(),box=await dialog.boundingBox();expect(field).toBeTruthy();expect(box).toBeTruthy();
  await page.mouse.move(field!.x+field!.width-10,field!.y+field!.height/2);await page.mouse.down();await page.mouse.move(field!.x+10,field!.y+field!.height/2,{steps:8});
  expect(await name.evaluate(node=>(node as HTMLInputElement).selectionEnd!-(node as HTMLInputElement).selectionStart!)).toBeGreaterThan(0);
  await page.mouse.move(box!.x-20,field!.y+field!.height/2,{steps:8});await page.mouse.up();await expect(dialog).toBeVisible();await expect(name).toHaveValue('Selection draft must stay');
  await page.mouse.click(box!.x-20,box!.y+box!.height/2);await expect(dialog).toHaveCount(0);
  await page.getByRole('button',{name:'Add course',exact:true}).click();await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
  await page.getByRole('button',{name:'Add course',exact:true}).click();await page.getByRole('button',{name:'Close dialog',exact:true}).click();await expect(dialog).toHaveCount(0);
  expect((await page.evaluate(()=>window.lime.call<Snapshot>('snapshot'))).records.filter(record=>record.kind==='course')).toHaveLength(0);
 }finally{await desktop.close();}
 await retain(info,{actualSelectionDrag:true,releaseOutsidePreservesDraft:true,trueBackdropDismissal:true,escapeAndClose:true,noUnsavedCourseWritten:true});
});

test('keeps native filter options black on white through every preset and a custom palette while filtering normally',async({},info)=>{
 const desktop=await startDesktop(copy,path.join(copy.root,'course-options'));
 try{
  const page=desktop.page;await page.setViewportSize({width:1600,height:1000});const course=await createCourse(page),state=await page.evaluate(()=>window.lime.call<Snapshot>('snapshot')),date=await page.locator('.day-cell.today [data-day]').getAttribute('data-day');
  const item=makeItem(randomUUID(),date!,state.displayZone!,'event');item.title='Filtered course fixture';item.courseId=course.id;await page.evaluate(value=>window.lime.call('save',value),item);
  async function options(){const colors=await page.locator('select option').evaluateAll(nodes=>nodes.map(node=>({color:getComputedStyle(node).color,background:getComputedStyle(node).backgroundColor})));expect(colors.length).toBeGreaterThan(2);for(const value of colors)expect(value).toEqual({color:'rgb(0, 0, 0)',background:'rgb(255, 255, 255)'});await page.getByRole('combobox',{name:'Filter calendar by course'}).selectOption(course.id);const event=page.locator('.calendar-event').filter({hasText:item.title});await expect(event).toBeVisible();await event.hover();await accessible(page);await page.getByRole('combobox',{name:'Filter calendar by course'}).selectOption('');}
  for(const [name,id]of [['Purple & black','purple'],['Black & white','mono'],['Navy & gold','navy']]){await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name,exact:true}).click();await expect(page.locator('html')).toHaveAttribute('data-appearance',id);await page.getByRole('button',{name:'Calendar',exact:true}).click();await options();await accessible(page);}
  await page.screenshot({path:info.outputPath('navy-course-filter.png')});await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'Create custom theme',exact:true}).click();await page.getByLabel('Theme name',{exact:true}).fill('Course option light');await page.getByLabel('background hex color',{exact:true}).fill('#ffffff');await page.getByLabel('surface hex color',{exact:true}).fill('#f3f4f6');await page.getByLabel('accent hex color',{exact:true}).fill('#254d8c');await page.getByRole('button',{name:'Save and apply theme',exact:true}).click();await page.getByRole('button',{name:'Calendar',exact:true}).click();await options();await accessible(page);
 }finally{await desktop.close();}
 await retain(info,{optionColorsBlackOnWhite:true,presets:3,customLightPalette:true,filterSelectsSavedCourse:true,automatedAccessibility:true,nativePopupPaintingObserved:false});
});
