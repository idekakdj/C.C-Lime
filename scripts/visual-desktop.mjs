import {_electron as electron} from '@playwright/test';
import {DateTime} from 'luxon';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs/promises';
const profile=path.resolve('test-results/visual-profile',randomUUID());await fs.mkdir(profile,{recursive:true});
const app=await electron.launch({executablePath:path.resolve('out/C.C. Lime-win32-x64/cc-lime.exe'),args:[`--cc-lime-test-profile=${profile}`],timeout:60000});
try{
  const page=await app.firstWindow();await page.getByRole('button',{name:/Explore a local calendar/}).click();await page.getByRole('button',{name:'Use defaults'}).click();
  const call=(command,payload)=>page.evaluate(({command,payload})=>window.lime.call(command,payload),{command,payload});
  const now=DateTime.now().setZone('America/Toronto'),today=now.toISODate(),first=now.startOf('month'),zone='America/Toronto';
  const semester={id:randomUUID(),kind:'semester',name:`Fall ${now.year}`,startDate:`${now.year}-09-01`,endDate:`${now.year}-12-18`,zone,breaks:[]};await call('save',semester);
  const courses=[['CS 201','Data Structures','#bda1f0'],['CHEM 102','General Chemistry','#7ab8cd'],['ECON 101','Microeconomics','#d5b582'],['MATH 201','Linear Algebra','#97baa7']].map(([code,name,color])=>({id:randomUUID(),kind:'course',name,code,color,semesterId:semester.id}));for(const course of courses)await call('save',course);
  for(let i=0;i<4;i++){const start=first.set({hour:9+i*2});await call('save',{id:randomUUID(),kind:'item',title:['Data Structures','Chemistry lecture','Microeconomics','Linear Algebra'][i],itemType:'class',courseId:courses[i].id,location:['Room 204 · North Hall','Science Building 3','Lecture Hall A','Math Centre 105'][i],timing:{mode:'timed',start:start.toUTC().toISO(),end:start.plus({minutes:75}).toUTC().toISO(),zone},recurrence:{frequency:'WEEKLY',interval:1,weekdays:i%2?[2,4]:[1,3],until:semester.endDate}});}
  const tasks=[['Read chapter 4',0,0,'assignment'],['Problem set 03',1,3,'assignment'],['Lab report: reaction rates',2,1,'assignment'],['Midterm review session',3,0,'study'],['Economics quiz',5,2,'exam']];
  for(const [title,offset,course,itemType]of tasks){const date=now.plus({days:offset}).toISODate();const start=now.plus({days:offset}).set({hour:15,minute:0});await call('save',{id:randomUUID(),kind:'item',title,itemType,courseId:courses[course].id,priority:offset===2?'high':'normal',timing:itemType==='study'?{mode:'timed',start:start.toUTC().toISO(),end:start.plus({hours:1}).toUTC().toISO(),zone}:{mode:'deadline',date,time:null,zone,anchorTime:'09:00'}});}
  await call('save',{id:randomUUID(),kind:'item',title:'Coffee with Maya',itemType:'event',timing:{mode:'timed',start:now.plus({days:2}).set({hour:11,minute:0}).toUTC().toISO(),end:now.plus({days:2}).set({hour:12,minute:0}).toUTC().toISO(),zone}});
  await page.locator('.calendar-event').filter({hasText:'Read chapter 4'}).waitFor();await page.screenshot({path:'test-results/calendar-month.png',fullPage:true});
  await page.locator(`[data-day="${today}"]`).click();await page.locator(`#day-panel-${today}`).waitFor();await page.screenshot({path:'test-results/calendar-day.png',fullPage:true});
  await page.getByRole('button',{name:'Add item',exact:true}).first().click();await page.getByRole('dialog').waitFor();await page.screenshot({path:'test-results/calendar-editor.png'});await page.getByRole('button',{name:'Close dialog'}).click();
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(800,900));await page.screenshot({path:'test-results/calendar-narrow.png',fullPage:true});
  console.log('Saved month, expanded day, editor, and narrow screenshots under test-results.');
}finally{await app.close();}
