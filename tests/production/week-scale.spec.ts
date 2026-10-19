import { test,expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { DateTime } from 'luxon';
import { makeItem,type Snapshot } from '../../src/shared/model';
import { rendererCopy,startDesktop } from './desktop.mjs';

test('weekly hourly box is 50% taller, all-day visibility defaults shown and persists without losing records',async({},info)=>{
 const copy=await rendererCopy(),profile=path.join(copy.root,'weekly-visibility');let desktop=await startDesktop(copy,profile);
 try{
  let page=desktop.page;await page.setViewportSize({width:1600,height:1000});
  const date=(await page.locator('.day-cell.today [data-day]').getAttribute('data-day'))!,state=await page.evaluate(()=>window.lime.call<Snapshot>('snapshot')),zone=state.displayZone!;
  const task={...makeItem(randomUUID(),date,zone,'task'),title:'Toggle preserves this task',timing:{mode:'deadline' as const,date,time:null,zone,anchorTime:'09:00'}};
  await page.evaluate(item=>window.lime.call('save',item),task);await page.getByRole('button',{name:'Week',exact:true}).click();
  const geometry=()=>page.locator('.week-scroll').evaluate(el=>{const area=el.closest('.calendar-area')!,layout=area.closest('.calendar-layout')!,footer=area.querySelector('.calendar-footer')!;const room=Math.floor(innerHeight-(el.getBoundingClientRect().top+scrollY)-footer.getBoundingClientRect().height-(parseFloat(getComputedStyle(layout).paddingBottom)||0)-3);return {actual:el.getBoundingClientRect().height,expected:Math.max(268.8,Math.floor(room*1.5)),width:el.getBoundingClientRect().width,hour:document.querySelector('.time-axis>span')!.getBoundingClientRect().height};});
  const hide=()=>page.getByRole('button',{name:'Hide all day & due',exact:true}),show=()=>page.getByRole('button',{name:'Show all day & due',exact:true});
  await expect(hide()).toHaveAttribute('aria-expanded','true');await expect(page.locator('#week-all-day')).toBeVisible();
  await expect.poll(async()=>{const g=await geometry();return Math.abs(g.actual-g.expected);}).toBeLessThan(.1);
  const before=await geometry();expect(before.hour).toBe(56);await hide().click();await expect(show()).toHaveAttribute('aria-expanded','false');await expect(show()).toHaveAttribute('aria-controls','week-all-day');await expect(page.locator('#week-all-day')).toBeHidden();
  await expect.poll(async()=>(await geometry()).actual).toBeGreaterThan(before.actual);expect((await geometry()).width).toBe(before.width);expect((await geometry()).hour).toBe(56);
  expect((await page.evaluate(()=>window.lime.call<Snapshot>('snapshot'))).records.some(record=>record.id===task.id)).toBe(true);
  await desktop.close();desktop=await startDesktop(copy,profile);page=desktop.page;await expect(show()).toBeVisible();await expect(page.locator('#week-all-day')).toBeHidden();
  await show().focus();await page.keyboard.press('Enter');await expect(hide()).toHaveAttribute('aria-expanded','true');await expect(page.locator('#week-all-day').getByRole('button',{name:task.title,exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Fit week',exact:true}).click();const fitted=Number(await page.getByRole('slider',{name:'Time-slot scale',exact:true}).inputValue());await hide().click();await expect.poll(async()=>Number(await page.getByRole('slider',{name:'Time-slot scale',exact:true}).inputValue())).toBeGreaterThan(fitted);
  await show().click();await page.locator('#week-all-day').getByRole('button',{name:task.title,exact:true}).click();await expect(page.getByRole('dialog',{name:'Edit your plan',exact:true})).toBeVisible();await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await page.screenshot({path:info.outputPath('taller-week-all-day-shown.png')});
 }finally{await desktop.close();}
 await fs.writeFile(info.outputPath('summary.json'),JSON.stringify({version:copy.version,packageSha256:copy.packageSha256,viewport150Percent:true,manualHourSpacingUnchanged:true,visibilityDefaultShown:true,visibilityRestart:true,hiddenRecordsPreserved:true,keyboardToggle:true,fitRemeasures:true,normalExit:true},null,2));
});

test('weekly fit preserves all-day/sidebar/column/text sizes, handles short collisions and persists without hiding in-progress tasks',async({},info)=>{
  const copy=await rendererCopy(),profile=path.join(copy.root,'week-scale');let desktop=await startDesktop(copy,profile);
  try{
    let page=desktop.page;await page.setViewportSize({width:1600,height:1000});
    const date=(await page.locator('.day-cell.today [data-day]').getAttribute('data-day'))!,state=await page.evaluate(()=>window.lime.call<Snapshot>('snapshot')),zone=state.displayZone!;
    const timed=(title:string,start:string,minutes:number)=>{const value=makeItem(randomUUID(),date,zone);const instant=DateTime.fromISO(`${date}T${start}`,{zone});value.title=title;value.timing={mode:'timed',start:instant.toUTC().toISO()!,end:instant.plus({minutes}).toUTC().toISO()!,zone};return value;};
    const values=[timed('Midnight seminar','00:00',5),timed('Adjacent short meeting','00:10',5),timed('Midday event','12:00',60),timed('Late-night event','23:59',5)];
    const due=makeItem(randomUUID(),date,zone,'task');due.title='All day task';due.timing={mode:'deadline',date,time:null,zone,anchorTime:'09:00'};due.status='in_progress';
    await page.evaluate(async records=>{for(const value of records)await window.lime.call('save',value);},[...values,due]);
    await page.getByRole('button',{name:'Week',exact:true}).click();const scale=()=>page.getByRole('slider',{name:'Time-slot scale',exact:true});await expect(scale()).toHaveValue('100');
    const dimensions=async()=>page.evaluate(()=>{const box=(selector:string)=>{const rect=document.querySelector(selector)!.getBoundingClientRect();return {width:rect.width,height:rect.height};};return {allDay:box('.week-all-day'),allDayButton:box('.week-all-day button'),sidebar:box('.upcoming-sidebar'),grid:box('.week-time-grid'),track:box('.week-day-track'),font:getComputedStyle(document.querySelector('.week-block b')!).fontSize};});
    const original=await dimensions();await page.getByRole('button',{name:'Fit week',exact:true}).click();await expect(page.getByRole('button',{name:'Fit week',exact:true})).toHaveAttribute('aria-pressed','true');
    const fits=async()=>page.locator('.week-scroll').evaluate(el=>({scrollHeight:el.scrollHeight,height:el.clientHeight,top:el.scrollTop}));
    await expect.poll(async()=>{const result=await fits();return result.scrollHeight-result.height;}).toBeLessThanOrEqual(1);
    const fit=await dimensions();expect(fit.allDay).toEqual(original.allDay);expect(fit.allDayButton).toEqual(original.allDayButton);expect(fit.sidebar).toEqual(original.sidebar);expect(fit.grid.width).toBe(original.grid.width);expect(fit.track.width).toBe(original.track.width);expect(fit.font).toBe(original.font);expect(fit.grid.height).toBeLessThan(original.grid.height);expect((await fits()).top).toBe(0);
    for(const value of values){const block=page.locator('.week-block').filter({hasText:value.title});expect(await block.evaluateAll(elements=>elements.length>0&&elements.every(el=>{const box=el.getBoundingClientRect(),grid=el.closest('.week-time-grid')!.getBoundingClientRect();return box.top>=grid.top&&box.bottom<=grid.bottom+.1;}))).toBe(true);}
    const first=await page.locator('.week-block').filter({hasText:values[0].title}).boundingBox(),second=await page.locator('.week-block').filter({hasText:values[1].title}).boundingBox();expect(first!.x+first!.width).toBeLessThanOrEqual(second!.x+.1);
    await page.screenshot({path:info.outputPath('weekly-fit.png')});
    await page.setViewportSize({width:1600,height:900});await expect.poll(async()=>{const result=await fits();return result.scrollHeight-result.height;}).toBeLessThanOrEqual(1);expect((await dimensions()).allDay).toEqual(original.allDay);
    await scale().focus();await page.keyboard.press('End');await expect(scale()).toHaveValue('100');await expect.poll(async()=>page.locator('.time-axis>span').first().evaluate(el=>el.getBoundingClientRect().height)).toBe(56);
    await page.keyboard.press('ArrowLeft');await expect(scale()).toHaveValue('99');
    await desktop.close();desktop=await startDesktop(copy,profile);page=desktop.page;await expect(scale()).toHaveValue('99');
    await page.getByRole('button',{name:'Fit week',exact:true}).click();await desktop.close();desktop=await startDesktop(copy,profile);page=desktop.page;await expect(page.getByRole('button',{name:'Fit week',exact:true})).toHaveAttribute('aria-pressed','true');
    await page.getByRole('button',{name:/^My tasks(?:\s+\d+)?$/}).click();await expect(page.locator('.tasks-toolbar').getByRole('button')).toHaveCount(2);await expect(page.getByRole('button',{name:'In progress',exact:true})).toHaveCount(0);
    await expect(page.getByText(due.title,{exact:true})).toBeVisible();await page.getByRole('button',{name:`Complete ${due.title}`,exact:true}).click();await page.getByRole('button',{name:'Completed',exact:true}).click();await expect(page.getByText(due.title,{exact:true})).toBeVisible();
  }finally{await desktop.close();}
  await fs.writeFile(info.outputPath('summary.json'),JSON.stringify({version:copy.version,packageSha256:copy.packageSha256,fixturePolicy:copy.policy,weeklyFit:true,originalMaximum:true,unchangedAllDayAndSidebar:true,unchangedColumnAndFontSizes:true,shortEventLanes:true,lateEventContained:true,resizeFit:true,manualAndFitRestart:true,legacyInProgressCompletion:true,normalExit:true},null,2));
});

test('compressed weekly dragging and resizing use scaled time, retain cancel/keyboard editing and save reviewed times',async({},info)=>{
  const copy=await rendererCopy(),desktop=await startDesktop(copy,path.join(copy.root,'scaled-movement'));
  try{
    const page=desktop.page;await page.setViewportSize({width:1600,height:1000});
    const date=(await page.locator('.day-cell.today [data-day]').getAttribute('data-day'))!,state=await page.evaluate(()=>window.lime.call<Snapshot>('snapshot')),zone=state.displayZone!;
    const value=makeItem(randomUUID(),date,zone);value.title='Scaled movement';
    await page.evaluate(item=>window.lime.call('save',item),value);await page.getByRole('button',{name:'Week',exact:true}).click();await page.getByRole('button',{name:'Fit week',exact:true}).click();
    const track=page.locator(`[data-week-date="${date}"]`),block=track.locator('.week-block'),editor=page.getByRole('dialog',{name:'Edit your plan',exact:true});
    await block.scrollIntoViewIfNeeded();const hour=await page.locator('.time-axis>span').first().evaluate(el=>el.getBoundingClientRect().height),target=await track.boundingBox(),source=await block.boundingBox();
    expect(hour).toBeLessThan(56);expect(target).not.toBeNull();expect(source).not.toBeNull();
    const offset=8;await page.mouse.move(source!.x+source!.width/2,source!.y+offset);await page.mouse.down();await page.mouse.move(source!.x+source!.width/2+8,source!.y+offset,{steps:3});
    await page.mouse.move(target!.x+target!.width/2,target!.y+10.25*hour+offset,{steps:8});await page.mouse.up();
    await expect(editor.getByLabel('Start time',{exact:true})).toHaveValue('10:15');await expect(editor.getByLabel('End time',{exact:true})).toHaveValue('11:15');await editor.getByRole('button',{name:'Save changes',exact:true}).click();await expect(editor).toHaveCount(0);
    const handle=page.getByRole('button',{name:`Resize ${value.title}; Enter opens time controls`,exact:true});await handle.hover();let box=(await handle.boundingBox())!;
    await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2,box.y+box.height/2+hour/2,{steps:4});await page.keyboard.press('Escape');await page.mouse.up();await expect(editor).toHaveCount(0);
    await handle.hover();box=(await handle.boundingBox())!;await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2,box.y+box.height/2+hour/2,{steps:4});await page.mouse.up();await expect(editor.getByLabel('End time',{exact:true})).toHaveValue('11:45');await editor.getByRole('button',{name:'Save changes',exact:true}).click();await expect(editor).toHaveCount(0);
    await handle.focus();await page.keyboard.press('Enter');await expect(editor.getByLabel('End time',{exact:true})).toHaveValue('11:45');await editor.getByRole('button',{name:'Cancel',exact:true}).click();
  }finally{await desktop.close();}
  await fs.writeFile(info.outputPath('summary.json'),JSON.stringify({version:copy.version,packageSha256:copy.packageSha256,fixturePolicy:copy.policy,scaledDragReviewed:true,scaledResizeReviewed:true,escapeCancels:true,keyboardEditing:true,normalExit:true},null,2));
});

test('five all-day items retain their full size while fit responds to header height and protects very short windows',async({},info)=>{
  const copy=await rendererCopy(),desktop=await startDesktop(copy,path.join(copy.root,'busy-all-day'));
  try{
    const page=desktop.page;await page.setViewportSize({width:1600,height:1100});
    const date=(await page.locator('.day-cell.today [data-day]').getAttribute('data-day'))!,state=await page.evaluate(()=>window.lime.call<Snapshot>('snapshot')),zone=state.displayZone!;
    await page.getByRole('button',{name:'Week',exact:true}).click();await page.getByRole('button',{name:'Fit week',exact:true}).click();
    const before=Number(await page.getByRole('slider',{name:'Time-slot scale',exact:true}).inputValue());
    const values=Array.from({length:5},(_,i)=>({...makeItem(randomUUID(),date,zone,'task'),title:`All-day plan ${i}`,timing:{mode:'deadline' as const,date,time:null,zone,anchorTime:'09:00'}}));
    await page.evaluate(async values=>{for(const value of values)await window.lime.call('save',value);},values);await expect(page.locator('.week-all-day button')).toHaveCount(5);
    await expect.poll(async()=>Number(await page.getByRole('slider',{name:'Time-slot scale',exact:true}).inputValue())).toBeLessThan(before);
    const measure=async()=>page.locator('.week-all-day').evaluate(el=>({height:el.getBoundingClientRect().height,buttonHeight:el.querySelector('button')!.getBoundingClientRect().height,font:getComputedStyle(el.querySelector('button')!).fontSize}));
    const fit=await measure();await expect.poll(()=>page.locator('.week-scroll').evaluate(el=>el.scrollHeight-el.clientHeight)).toBeLessThanOrEqual(1);await page.screenshot({path:info.outputPath('five-all-day-fit.png')});
    await page.getByRole('button',{name:'100%',exact:true}).click();expect(await measure()).toEqual(fit);
    await page.getByRole('button',{name:'Fit week',exact:true}).click();await page.setViewportSize({width:1480,height:930});await expect(page.locator('.week-fit-hint')).toHaveCount(0);await expect.poll(()=>page.locator('.week-scroll').evaluate(el=>el.scrollHeight-el.clientHeight)).toBeLessThanOrEqual(1);
    await page.setViewportSize({width:1600,height:650});await expect(page.locator('.week-fit-hint')).toBeVisible();expect(await measure()).toEqual(fit);await expect(page.getByRole('slider',{name:'Time-slot scale',exact:true})).toHaveValue('20');
  }finally{await desktop.close();}
  await fs.writeFile(info.outputPath('summary.json'),JSON.stringify({version:copy.version,packageSha256:copy.packageSha256,fixturePolicy:copy.policy,fiveAllDayItemsUnchanged:true,automaticHeaderReflow:true,shortWindowReadableFallback:true,normalExit:true},null,2));
});
