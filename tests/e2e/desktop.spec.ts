import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { DateTime } from 'luxon';
import { makeItem, courseSchema, semesterSchema, type Snapshot } from '../../src/shared/model';
import AxeBuilder from '@axe-core/playwright';

let app:ElectronApplication,page:Page,profile:string,errors:string[];
const executable=process.env.CC_LIME_TEST_EXECUTABLE??path.resolve('out/C.C. Lime-win32-x64/cc-lime.exe');
const today=DateTime.now().toISODate()!;
async function launch(){app=await electron.launch({executablePath:executable,args:[`--cc-lime-test-profile=${profile}`],timeout:60000});page=await app.firstWindow();page.on('pageerror',error=>errors.push(error.message));await expect(page.getByRole('button',{name:/Explore a local calendar/})).toBeVisible();await page.getByRole('button',{name:/Explore a local calendar/}).click();await expect(page.getByRole('heading',{name:'Your calendar',exact:true})).toBeVisible();const state=await page.evaluate(()=>window.lime.call<Snapshot>('snapshot'));if(!state.device.onboardingDone){await page.getByRole('button',{name:'Use defaults'}).click();await expect(page.getByRole('dialog')).not.toBeVisible();}}
test.beforeEach(async()=>{profile=path.resolve('test-results/profiles',randomUUID());await fs.mkdir(profile,{recursive:true});errors=[];await launch();});
test.afterEach(async()=>{await app?.close();expect(errors).toEqual([]);});
async function call(command:string,payload?:unknown){return page.evaluate(({command,payload})=>window.lime.call(command,payload),{command,payload});}
async function calendarZone(zone:string){const snapshot=await call('snapshot')as Snapshot,existing=snapshot.records.find(r=>r.kind==='preferences');await call('save',{...(existing??{id:randomUUID(),kind:'preferences'}),zone});}
async function upcomingSidebar(){
  const toggle=page.getByRole('button',{name:'Show upcoming tasks',exact:true});
  if(await toggle.isVisible())await toggle.click();
  const sidebar=page.getByRole('complementary',{name:'Upcoming tasks for the next 7 days'});await expect(sidebar).toBeVisible();return sidebar;
}
async function dragWeekItem(title:string,date:string,minutes:number){
  const block=page.locator('.week-block').filter({hasText:title}).first(),track=page.locator(`[data-week-date="${date}"]`);
  await block.scrollIntoViewIfNeeded();const start=await block.boundingBox(),target=await track.boundingBox();if(!start||!target)throw new Error('Week block is not visible.');
  await page.mouse.move(start.x+20,start.y+8);await page.mouse.down();await page.mouse.move(start.x+25,start.y+14,{steps:4});await page.mouse.move(target.x+20,target.y+minutes/60*56+8,{steps:8});await page.mouse.up();
}
test('keeps every item reachable on a crowded day without rendering the whole day at once',async()=>{
  const values=Array.from({length:57},(_,i)=>({...makeItem(randomUUID(),today,'America/Toronto'),title:`Crowded ${String(i).padStart(2,'0')}`}));
  await page.evaluate(async values=>{for(const value of values)await window.lime.call('save',value);},values);
  await expect(page.locator('.calendar-event').filter({hasText:'Crowded 00'})).toBeVisible();
  await page.locator(`[data-day="${today}"]`).click();const panel=page.locator(`#day-panel-${today}`);
  await expect(panel.locator('.item-row')).toHaveCount(50);
  await panel.getByRole('button',{name:'Show 7 more items'}).click();
  await expect(panel.locator('.item-row')).toHaveCount(57);
  await expect(panel.getByText('Crowded 56',{exact:true})).toBeAttached();
});
test('pages large task lists and retains edits through view refreshes and sign-out',async()=>{
  const values=Array.from({length:57},(_,i)=>({...makeItem(randomUUID(),today,'America/Toronto','task'),title:`Task batch ${String(i).padStart(2,'0')}`,timing:{mode:'unscheduled' as const,zone:'America/Toronto'}}));
  await page.evaluate(async values=>{for(const value of values)await window.lime.call('save',value);},values);
  await page.getByRole('button',{name:'My tasks',exact:true}).click();const section=page.locator('.task-section').filter({has:page.getByRole('heading',{name:/No due date/})});
  await expect(section.locator('.item-row')).toHaveCount(50);await section.getByRole('button',{name:'Show 7 more items'}).click();await expect(section.locator('.item-row')).toHaveCount(57);
  await section.getByRole('button',{name:'Complete Task batch 56',exact:true}).click();await expect(section.locator('.item-row')).toHaveCount(56);await page.getByRole('button',{name:'Completed',exact:true}).click();await expect(page.locator('.tasks-page .item-row')).toHaveCount(1);await expect(page.getByText('Task batch 56',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Calendar',exact:true}).click();await page.getByRole('button',{name:'Next period'}).click();await page.getByRole('button',{name:'Previous period'}).click();await page.getByRole('button',{name:'My tasks',exact:true}).click();await expect(page.getByText('Task batch 56',{exact:true})).toBeVisible();
  await call('auth.signOut');await expect(page.getByRole('button',{name:/Explore a local calendar/})).toBeVisible();await expect(page.getByText('Task batch 56',{exact:true})).not.toBeVisible();await page.getByRole('button',{name:/Explore a local calendar/}).click();await page.getByRole('button',{name:'My tasks',exact:true}).click();await expect(page.getByText('Task batch 56',{exact:true})).toBeVisible();
});
test('creates, expands, edits, and preserves an event after a real app restart',async()=>{
  await page.getByRole('button',{name:'Add item',exact:true}).first().click();const dialog=page.getByRole('dialog');await dialog.getByLabel('Title',{exact:true}).fill('Algorithms office hours');await dialog.getByRole('button',{name:'Add to calendar'}).click();await expect(dialog).not.toBeVisible();await expect(page.getByRole('button',{name:/Algorithms office hours/}).first()).toBeVisible();
  await page.locator(`[data-day="${today}"]`).click();const dayPanel=page.locator(`#day-panel-${today}`);await expect(dayPanel).toBeVisible();await expect(dayPanel.getByRole('button',{name:/Algorithms office hours/})).toBeVisible();
  await dayPanel.getByRole('button',{name:/Algorithms office hours/}).click();await page.getByRole('dialog').getByLabel('Title',{exact:true}).fill('Algorithms office hours — updated');await page.getByRole('button',{name:'Save changes'}).click();await app.close();await launch();
  const snapshot=await call('snapshot')as Snapshot;expect(snapshot.records.some(r=>r.kind==='item'&&r.title==='Algorithms office hours — updated')).toBe(true);await expect(page.getByRole('button',{name:/Algorithms office hours — updated/}).first()).toBeVisible();
});
test('recovers an acknowledged calendar save after an abrupt main-process exit',async()=>{
  const value=makeItem(randomUUID(),today,'America/Toronto');value.title='Durable before interruption';await call('save',value);
  // On Windows Playwright's child is a shell wrapper; target the app's verified main process.
  const runtime=await app.evaluate(({app})=>({pid:process.pid,profile:app.getPath('userData')}));expect(runtime.profile).toBe(profile);
  const closed=app.waitForEvent('close');process.kill(runtime.pid,'SIGKILL');await closed;await launch();
  expect((await call('snapshot')as Snapshot).records.find(r=>r.id===value.id)).toMatchObject({title:value.title});
});
test('hides to the tray and a second launch restores the existing window',async()=>{
  await app.evaluate(({app,BrowserWindow,dialog})=>{(globalThis as any).limeSecondLaunches=0;app.on('second-instance',()=>{(globalThis as any).limeSecondLaunches++;});dialog.showMessageBox=(async()=>({response:0,checkboxChecked:false}))as any;BrowserWindow.getAllWindows()[0].close();});
  await expect.poll(()=>app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isVisible())).toBe(false);
  const child=spawn(executable,[`--cc-lime-test-profile=${profile}`],{stdio:'ignore',windowsHide:true});
  try{
    await expect.poll(()=>app.evaluate(()=> (globalThis as any).limeSecondLaunches)).toBe(1);
    await expect.poll(()=>app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isVisible())).toBe(true);
    expect(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().length)).toBe(1);
    await expect.poll(()=>child.exitCode).toBe(0);
  }finally{if(child.exitCode===null)child.kill();}
});
test('finishes a task from the seven-day sidebar and can undo it',async()=>{
  const value=makeItem(randomUUID(),today,'America/Toronto','task');value.title='Read the next chapter';value.timing={mode:'deadline',date:today,time:null,zone:'America/Toronto',anchorTime:'09:00'};await call('save',value);
  const sidebar=await upcomingSidebar();await expect(sidebar.getByRole('button',{name:'Complete Read the next chapter',exact:true})).toBeVisible();await sidebar.getByRole('button',{name:'Complete Read the next chapter',exact:true}).click();await expect(sidebar.getByRole('button',{name:'Complete Read the next chapter',exact:true})).not.toBeVisible();await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(sidebar.getByRole('button',{name:'Complete Read the next chapter',exact:true})).toBeVisible();
});
test('edits only one recurring occurrence and retains the underlying series',async()=>{
  const value=makeItem(randomUUID(),today,'America/Toronto','study');value.title='Weekly study block';value.recurrence={frequency:'WEEKLY',interval:1,weekdays:[DateTime.fromISO(today).weekday],until:null,count:8,monthlyMode:'date',ordinal:1,excludedDates:[],extraDates:[]};await call('save',value);
  await page.locator('.calendar-event').filter({hasText:'Weekly study block'}).first().click();const dialog=page.getByRole('dialog');await expect(dialog.getByLabel('Edit repeating item scope')).toHaveValue('one');await dialog.getByLabel('Title',{exact:true}).fill('Study at the library');await dialog.getByRole('button',{name:'Save changes'}).click();await expect(dialog).not.toBeVisible();const snapshot=await call('snapshot')as Snapshot;expect(snapshot.records.find(r=>r.id===value.id)).toMatchObject({title:'Weekly study block'});expect(snapshot.records.find(r=>r.kind==='exception')).toMatchObject({override:{title:'Study at the library'}});
});
test('creates a semester and course using the management screens',async()=>{
  await page.getByRole('button',{name:'Courses & semesters',exact:true}).click();await page.getByRole('button',{name:'Add semester',exact:true}).first().click();let dialog=page.getByRole('dialog');await dialog.getByLabel('Name',{exact:true}).fill('Fall semester');await dialog.getByRole('button',{name:'Save semester'}).click();await expect(dialog).not.toBeVisible();await page.getByRole('button',{name:'Add course',exact:true}).first().click();dialog=page.getByRole('dialog');await dialog.getByLabel('Course name',{exact:true}).fill('Data structures');await dialog.getByLabel('Course code',{exact:true}).fill('CS 201');await dialog.getByRole('combobox',{name:'Semester',exact:true}).selectOption({label:'Fall semester'});await dialog.getByRole('button',{name:'Save course'}).click();await expect(page.getByRole('heading',{name:'Data structures',exact:true})).toBeVisible();
});
test('operates calendar keyboard navigation, alternate views, search and narrow layout',async()=>{
  const value=makeItem(randomUUID(),today,'America/Toronto');value.title='A searchable seminar';value.notes='quartz meeting';await call('save',value);await page.locator(`[data-day="${today}"]`).focus();await page.keyboard.press('Enter');await expect(page.locator(`#day-panel-${today}`)).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator(`#day-panel-${today}`)).not.toBeVisible();await page.keyboard.press('Control+f');await expect(page.getByRole('textbox',{name:'Search your calendar'})).toBeFocused();await page.keyboard.type('quartz');await expect(page.locator('.search-results').getByRole('button',{name:/A searchable seminar/})).toBeVisible();await page.getByRole('button',{name:'Clear search'}).click();await page.getByRole('button',{name:'Week',exact:true}).click();await expect(page.locator('.week-view')).toBeVisible();await page.getByRole('button',{name:'Agenda',exact:true}).click();await expect(page.locator('.agenda-list')).toBeVisible();await page.getByRole('button',{name:'Month',exact:true}).click();
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(800,850));await expect(page.getByRole('button',{name:'Open navigation'})).toBeVisible();await page.getByRole('button',{name:'Show upcoming tasks'}).click();await expect(page.getByRole('complementary',{name:'Upcoming tasks for the next 7 days'})).toBeVisible();await page.getByRole('button',{name:'Close upcoming tasks',exact:true}).last().click();
});
test('has an isolated renderer, rejects unknown commands and stores no browser credentials',async()=>{
  const prefs=await app.evaluate(({BrowserWindow})=>(BrowserWindow.getAllWindows()[0].webContents as any).getLastWebPreferences());expect(prefs.contextIsolation).toBe(true);expect(prefs.sandbox).toBe(true);expect(prefs.nodeIntegration).toBe(false);expect(await page.evaluate(()=>typeof (window as any).require)).toBe('undefined');expect(await page.evaluate(()=>Object.keys(localStorage))).toEqual([]);expect(await page.evaluate(async()=>{try{await window.lime.call('executeScript','evil');return false;}catch{return true;}})).toBe(true);
});
test('adds a new task without existing-item controls and changes its progress',async()=>{
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1024,850));
  const sidebar=await upcomingSidebar();await sidebar.getByRole('button',{name:'Add upcoming task',exact:true}).click();const dialog=page.getByRole('dialog');await expect(dialog.getByRole('heading',{name:'Make a little plan'})).toBeVisible();await expect(dialog.getByRole('button',{name:'Delete item',exact:true})).toHaveCount(0);await dialog.getByLabel('Title',{exact:true}).fill('Start research');await dialog.locator('summary').click();await dialog.getByRole('combobox',{name:'Progress',exact:true}).selectOption('in_progress');await dialog.getByRole('button',{name:'Add to calendar'}).click();await expect(dialog).not.toBeVisible();expect((await call('snapshot')as Snapshot).records.find(r=>r.kind==='item'&&r.title==='Start research')).toMatchObject({status:'in_progress'});
});
test('reviews removed occurrence history, cancels safely, and shows stale-preview errors in the active dialog',async()=>{
  const value=makeItem(randomUUID(),today,'America/Toronto');value.title='Repeating lecture';value.recurrence={frequency:'DAILY',interval:1,weekdays:[],until:null,count:8,monthlyMode:'date',ordinal:1,excludedDates:[],extraDates:[]};await call('save',value);await call('occurrence',{seriesId:value.id,date:today,action:'complete'});await page.locator('.calendar-event').filter({hasText:value.title}).first().click();
  const editor=page.getByRole('dialog',{name:'Edit your plan'});await editor.getByLabel('Edit repeating item scope').selectOption('series');await editor.getByRole('combobox',{name:'Frequency',exact:true}).selectOption('');await editor.getByRole('button',{name:'Save changes'}).click();
  const review=page.getByRole('dialog',{name:'Review repeating schedule'});await expect(review).toBeVisible();await expect(review.getByText('History needing your choice')).toBeVisible();
  await page.screenshot({path:path.join(profile,'schedule-review.png')});const accessibility=await new AxeBuilder({page}).setLegacyMode(true).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(accessibility.violations.map(v=>v.id)).toEqual([]);
  await review.getByRole('button',{name:'Back to editing'}).click();expect((await call('snapshot')as Snapshot).records.find(r=>r.id===value.id)).toMatchObject({recurrence:{count:8}});await expect(editor.getByRole('combobox',{name:'Frequency',exact:true})).toHaveValue('');
  await editor.getByRole('button',{name:'Save changes'}).click();await call('save',makeItem(randomUUID(),today,'America/Toronto'));await review.getByRole('button',{name:'Apply schedule',exact:true}).click();await expect(review.getByRole('alert')).toContainText('changed after this preview');
  await review.getByRole('button',{name:'Update preview'}).click();await review.getByLabel('When applying the new schedule').selectOption('discard');await expect(review.getByRole('button',{name:'Apply schedule',exact:true})).toBeDisabled();await review.getByLabel('When applying the new schedule').selectOption('preserve');await review.getByRole('button',{name:'Apply schedule',exact:true}).click();await expect(review).not.toBeVisible();
  const records=(await call('snapshot')as Snapshot).records;expect(records.find(r=>r.id===value.id)).toMatchObject({recurrence:null});expect(records.find(r=>r.kind==='item'&&r.id!==value.id&&r.title===value.title)).toMatchObject({status:'completed',recurrence:null});expect(records.some(r=>r.kind==='occurrenceState')).toBe(false);
});

test('requires confirmation before discarding dirty edits when switching recurrence scope',async()=>{
  const value=makeItem(randomUUID(),today,'America/Toronto');value.title='Scope lecture';value.recurrence={frequency:'WEEKLY',interval:2,weekdays:[DateTime.fromISO(today).weekday],until:null,count:8,monthlyMode:'date',ordinal:1,excludedDates:[],extraDates:[]};value.reminders=[{id:randomUUID(),minutesBefore:15}];await call('save',value);
  await page.locator('.calendar-event').filter({hasText:value.title}).first().click();const editor=page.getByRole('dialog',{name:'Edit your plan'});await editor.getByLabel('Title',{exact:true}).fill('Unsaved occurrence');await editor.getByLabel('Remind me (minutes before, separated by commas)').fill('90');await editor.getByLabel('Edit repeating item scope').selectOption('series');
  const prompt=page.getByRole('dialog',{name:'Switch editing scope?'});await prompt.getByRole('button',{name:'Keep editing'}).click();await expect(editor.getByLabel('Title',{exact:true})).toHaveValue('Unsaved occurrence');await expect(editor.getByLabel('Edit repeating item scope')).toHaveValue('one');
  await editor.getByLabel('Edit repeating item scope').selectOption('series');await prompt.getByRole('button',{name:'Discard edits and switch'}).click();await expect(editor.getByLabel('Title',{exact:true})).toHaveValue(value.title);await expect(editor.getByLabel('Remind me (minutes before, separated by commas)')).toHaveValue('15');await expect(editor.getByLabel('Every',{exact:true})).toHaveValue('2');
  await editor.getByRole('combobox',{name:'Frequency',exact:true}).selectOption('DAILY');await editor.getByLabel('Every',{exact:true}).fill('4');await editor.getByLabel('Edit repeating item scope').selectOption('one');await prompt.getByRole('button',{name:'Discard edits and switch'}).click();await editor.getByLabel('Edit repeating item scope').selectOption('series');await expect(editor.getByRole('combobox',{name:'Frequency',exact:true})).toHaveValue('WEEKLY');await expect(editor.getByLabel('Every',{exact:true})).toHaveValue('2');
});

test('previews linked class dates when editing a semester without shifting assignments',async()=>{
  const end=DateTime.fromISO(today).plus({days:21}).toISODate()!,shortEnd=DateTime.fromISO(today).plus({days:7}).toISODate()!;
  const semester=semesterSchema.parse({id:randomUUID(),kind:'semester',name:'Preview semester',startDate:today,endDate:end,zone:'America/Toronto'}),course=courseSchema.parse({id:randomUUID(),kind:'course',name:'Preview course',semesterId:semester.id});await call('save',semester);await call('save',course);
  const lecture=makeItem(randomUUID(),today,'America/Toronto','class');lecture.title='Bounded lecture';lecture.courseId=course.id;lecture.recurrence={frequency:'DAILY',interval:1,weekdays:[],until:end,count:null,monthlyMode:'date',ordinal:1,excludedDates:[],extraDates:[]};const assignment=makeItem(randomUUID(),end,'America/Toronto','assignment');assignment.courseId=course.id;await call('save',lecture);await call('save',assignment);
  await page.getByRole('button',{name:'Courses & semesters',exact:true}).click();await page.locator('.semester-card').filter({hasText:semester.name}).click();const editor=page.getByRole('dialog',{name:'Edit semester'});await editor.getByLabel('Last day',{exact:true}).fill(shortEnd);await editor.getByRole('button',{name:'Save semester',exact:true}).click();const review=page.getByRole('dialog',{name:'Review semester timetable changes'});await expect(review.getByRole('heading',{name:lecture.title})).toBeVisible();await expect(review.getByText(/22 → 8 meetings/)).toBeVisible();await review.getByRole('button',{name:'Apply timetable changes'}).click();await expect(review).not.toBeVisible();
  const records=(await call('snapshot')as Snapshot).records;expect(records.find(r=>r.id===lecture.id)).toMatchObject({recurrence:{until:shortEnd}});expect(records.find(r=>r.id===assignment.id)).toEqual(assignment);
});

test('inherits semester dates and zone for a new class and previews its meetings before saving',async()=>{
  const semester=semesterSchema.parse({id:randomUUID(),kind:'semester',name:'Class defaults',startDate:today,endDate:DateTime.fromISO(today).plus({days:21}).toISODate()!,zone:'Europe/London',breaks:[{startDate:today,endDate:today}]}),course=courseSchema.parse({id:randomUUID(),kind:'course',name:'New class course',semesterId:semester.id,location:'Room 101'});await call('save',semester);await call('save',course);
  await page.getByRole('button',{name:'Add item',exact:true}).first().click();const editor=page.getByRole('dialog',{name:'Make a little plan'});await editor.getByLabel('Title',{exact:true}).fill('New semester class');await editor.getByRole('combobox',{name:'Type',exact:true}).selectOption('class');await editor.getByRole('combobox',{name:'Course',exact:true}).selectOption(course.id);await expect(editor.getByLabel('Start date',{exact:true})).toHaveValue(today);await expect(editor.getByLabel('Time zone',{exact:true})).toHaveValue(semester.zone);await expect(editor.getByLabel('Last date',{exact:true})).toHaveValue(semester.endDate);await editor.getByRole('button',{name:'Add to calendar'}).click();
  const review=page.getByRole('dialog',{name:'Review repeating schedule'});await expect(review.getByText(/0 → 3 meetings/)).toBeVisible();expect((await call('snapshot')as Snapshot).records.filter(r=>r.kind==='item')).toHaveLength(0);await review.getByRole('button',{name:'Apply schedule',exact:true}).click();await expect(review).not.toBeVisible();expect((await call('snapshot')as Snapshot).records.find(r=>r.kind==='item')).toMatchObject({title:'New semester class',location:'Room 101',timing:{zone:semester.zone},recurrence:{until:semester.endDate,excludedDates:[today]}});
});

test('follows the computer zone on this device and restores the fixed zone after switching off',async()=>{
  const prefs={id:randomUUID(),kind:'preferences',zone:'Pacific/Honolulu'};await call('save',prefs);const initial=(await call('snapshot')as Snapshot).records.find(r=>r.kind==='preferences');
  // This controlled checkbox updates only after the main process saves settings.
  // Wait for that acknowledgement instead of check()'s immediate DOM assertion.
  await page.getByRole('button',{name:'Settings',exact:true}).click();const toggle=page.getByRole('checkbox',{name:/Follow this computer’s time zone/});await expect(toggle).not.toBeChecked();await toggle.click();await expect(toggle).toBeChecked();const systemZone=await app.evaluate(()=>new Intl.DateTimeFormat().resolvedOptions().timeZone);await expect(page.getByText(`Currently displaying ${systemZone}.`,{exact:false})).toBeVisible();expect((await call('snapshot')as Snapshot).records.find(r=>r.kind==='preferences')).toEqual(initial);
  await app.close();await launch();await page.getByRole('button',{name:'Settings',exact:true}).click();const restored=page.getByRole('checkbox',{name:/Follow this computer’s time zone/});await expect(restored).toBeChecked();await restored.click();await expect(restored).not.toBeChecked();await expect(page.getByText('Currently displaying Pacific/Honolulu.',{exact:false})).toBeVisible();
});

test('shows a native notification failure in Settings instead of a success message',async()=>{
  await app.evaluate(({Notification})=>{Notification.isSupported=()=>true;Notification.prototype.show=function(this:any){this.emit('failed',{},'Simulated test failure');};});
  await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'Send a test reminder',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Windows could not display');expect((await call('snapshot')as Snapshot).notificationTest?.state).toBe('failed');
});

test('snaps week dragging to time and cancels movement or resizing without changing saved data',async()=>{
  await calendarZone('America/Toronto');
  const value=makeItem(randomUUID(),today,'America/Toronto');value.title='Drag practice';await call('save',value);await page.getByRole('button',{name:'Week',exact:true}).click();await dragWeekItem(value.title,today,617);
  const editor=page.getByRole('dialog',{name:'Edit your plan'});await expect(editor.getByLabel('Start time',{exact:true})).toHaveValue('10:15');await expect(editor.getByLabel('End time',{exact:true})).toHaveValue('11:15');expect((await call('snapshot')as Snapshot).records.find(r=>r.id===value.id)).toEqual(value);
  await editor.getByRole('button',{name:'Cancel',exact:true}).click();await page.getByRole('dialog',{name:'Discard your changes?'}).getByRole('button',{name:'Discard changes'}).click();expect((await call('snapshot')as Snapshot).records.find(r=>r.id===value.id)).toEqual(value);
  await dragWeekItem(value.title,today,617);await editor.getByRole('button',{name:'Save changes'}).click();await expect(editor).not.toBeVisible();const moved=(await call('snapshot')as Snapshot).records.find(r=>r.id===value.id)!;
  const handle=page.getByRole('button',{name:`Resize ${value.title}; Enter opens time controls`});await expect(page.locator('.week-block').getByRole('button',{name:'Drag practice 10:15 AM',exact:true})).toBeVisible();await handle.hover();let box=await handle.boundingBox();if(!box)throw new Error('Resize handle missing.');await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2,box.y+box.height/2+28,{steps:4});await page.keyboard.press('Escape');await page.mouse.up();await expect(editor).not.toBeVisible();expect((await call('snapshot')as Snapshot).records.find(r=>r.id===value.id)).toEqual(moved);
  await handle.hover();box=await handle.boundingBox();if(!box)throw new Error('Resize handle missing.');await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2,box.y+box.height/2+28,{steps:4});await page.mouse.up();await expect(editor.getByLabel('End time',{exact:true})).toHaveValue('11:45');await editor.getByRole('button',{name:'Save changes'}).click();await expect(editor).not.toBeVisible();
});

test('asks recurrence scope for week movement and previews the shifted whole series',async()=>{
  await calendarZone('America/Toronto');
  const value=makeItem(randomUUID(),today,'America/Toronto');value.title='Moving lecture';value.recurrence={frequency:'WEEKLY',interval:1,weekdays:[DateTime.fromISO(today).weekday],until:null,count:3,monthlyMode:'date',ordinal:1,excludedDates:[],extraDates:[]};await call('save',value);await page.getByRole('button',{name:'Week',exact:true}).click();await dragWeekItem(value.title,today,630);
  const scope=page.getByRole('dialog',{name:'Move repeating item'});await expect(scope).toBeVisible();await scope.getByRole('button',{name:'Cancel move'}).click();expect((await call('snapshot')as Snapshot).records.find(r=>r.id===value.id)).toEqual(value);
  await dragWeekItem(value.title,today,630);await scope.getByRole('button',{name:'Entire series',exact:true}).click();const editor=page.getByRole('dialog',{name:'Edit your plan'});await expect(editor.getByLabel('Start time',{exact:true})).toHaveValue('10:30');await editor.getByRole('button',{name:'Save changes'}).click();const review=page.getByRole('dialog',{name:'Review repeating schedule'});await expect(review.getByText(/3 → 3 meetings/)).toBeVisible();await review.getByRole('button',{name:'Apply schedule',exact:true}).click();await expect(review).not.toBeVisible();const saved=(await call('snapshot')as Snapshot).records.find(r=>r.id===value.id);expect(saved?.kind==='item'&&saved.timing.mode==='timed'&&DateTime.fromISO(saved.timing.start).setZone('America/Toronto').toFormat('HH:mm')).toBe('10:30');expect((await call('snapshot')as Snapshot).records.filter(r=>r.kind==='exception')).toHaveLength(0);
});
test('has no automated WCAG A/AA violations in the calendar and item editor',async()=>{
  const calendar=await new AxeBuilder({page}).setLegacyMode(true).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(calendar.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);
  await page.getByRole('button',{name:'Add item',exact:true}).first().click();const editor=await new AxeBuilder({page}).setLegacyMode(true).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(editor.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);
});
test('keeps day details and task controls reachable at 200 percent zoom',async()=>{
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.setZoomFactor(2));await expect(page.getByRole('button',{name:'Show upcoming tasks'})).toBeVisible();await page.locator(`[data-day="${today}"]`).click();await expect(page.locator(`#day-panel-${today}`)).toBeVisible();await page.getByRole('button',{name:'Show upcoming tasks'}).click();await expect(page.getByRole('button',{name:'Add upcoming task'})).toBeVisible();await page.getByRole('button',{name:'Add upcoming task'}).click();await expect(page.getByRole('dialog').getByRole('button',{name:'Add to calendar'})).toBeInViewport();
});
test('previews, imports, exports, backs up, and restores a calendar file',async()=>{
  const file=path.join(profile,'university.ics');await fs.writeFile(file,'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:university-fixture\r\nSUMMARY:Imported seminar\r\nDTSTART:20260924T130000Z\r\nDTEND:20260924T140000Z\r\nEND:VEVENT\r\nEND:VCALENDAR');
  await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=(async()=>({canceled:false,filePaths:[file]}))as any;},file);
  await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:/Import a calendar/}).click();await page.getByRole('button',{name:'Choose .ics file'}).click();await expect(page.getByRole('dialog').getByText('Imported seminar',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Import selected changes'}).click();expect((await call('snapshot')as Snapshot).records.some(r=>r.kind==='item'&&r.title==='Imported seminar')).toBe(true);
  const backup=path.join(profile,'calendar-backup.json');await app.evaluate(({dialog},file)=>{dialog.showSaveDialog=(async()=>({canceled:false,filePath:file}))as any;},backup);await page.getByRole('button',{name:/Save a full backup/}).click();await expect.poll(async()=>{try{return (await fs.readFile(backup,'utf8')).includes('Imported seminar');}catch{return false;}}).toBe(true);
  const exported=path.join(profile,'exported.ics');await app.evaluate(({dialog},file)=>{dialog.showSaveDialog=(async()=>({canceled:false,filePath:file}))as any;},exported);await page.getByRole('button',{name:/Export your calendar/}).click();await page.getByRole('dialog').getByRole('button',{name:'Export calendar',exact:true}).click();await expect.poll(async()=>{try{return (await fs.readFile(exported,'utf8')).includes('BEGIN:VEVENT');}catch{return false;}}).toBe(true);
  await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=(async()=>({canceled:false,filePaths:[file]}))as any;},backup);await page.getByRole('button',{name:/Restore a full backup/}).click();await page.getByRole('button',{name:'Choose backup'}).click();await expect(page.getByRole('dialog').getByText(/records ready to restore/)).toBeVisible();await page.getByRole('button',{name:'Restore backup',exact:true}).click();await expect(page.getByRole('dialog')).not.toBeVisible();expect((await call('snapshot')as Snapshot).records.filter(r=>r.kind==='item'&&r.title==='Imported seminar')).toHaveLength(2);
});
