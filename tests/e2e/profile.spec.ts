import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Snapshot } from '../../src/shared/model';
import sharp from 'sharp';
let app:ElectronApplication,page:Page,profile:string;
const executable=process.env.CC_LIME_TEST_EXECUTABLE??path.resolve('out/C.C. Lime-win32-x64/cc-lime.exe');
async function launch(){app=await electron.launch({executablePath:executable,args:[`--cc-lime-test-profile=${profile}`],timeout:60000});page=await app.firstWindow();await page.getByRole('button',{name:/Explore a local calendar/}).click();await expect(page.getByRole('heading',{name:'Your calendar',exact:true})).toBeVisible();if(!(await page.evaluate(()=>window.lime.call<Snapshot>('snapshot'))).device.onboardingDone)await page.getByRole('button',{name:'Use defaults'}).click();}
test.beforeEach(async()=>{profile=path.resolve('test-results/profiles',`profile-${randomUUID()}`);await launch();});
test.afterEach(async()=>{await app?.close();});
test('uploads, persists, removes a profile icon and keeps lifetime progress after task deletion',async()=>{
 await page.getByRole('button',{name:'Open profile',exact:true}).click();await page.getByLabel('Username',{exact:true}).fill('Taylor Student');await page.getByRole('button',{name:'Save profile',exact:true}).click();
 await app.evaluate(({dialog},filename)=>{dialog.showOpenDialog=(async()=>({canceled:false,filePaths:[filename]}))as any;},path.resolve('assets/icon.png'));
 await page.getByRole('button',{name:'Upload photo',exact:true}).click();await page.getByRole('button',{name:'Save photo',exact:true}).click();await expect(page.getByAltText('Your profile',{exact:true})).toBeVisible();
 const taskId=randomUUID();await page.evaluate(async id=>{await window.lime.call('save',{id,kind:'item',title:'Completed progress fixture',itemType:'task',timing:{mode:'unscheduled',zone:'UTC'},status:'open'});await window.lime.call('complete',{id,completed:true});await window.lime.call('remove',{id});},taskId);
 await expect(page.getByTestId('lifetime-completions')).toHaveText('1');await app.close();await launch();await page.getByRole('button',{name:'Open profile',exact:true}).click();await expect(page.getByLabel('Username',{exact:true})).toHaveValue('Taylor Student');await expect(page.getByAltText('Your profile',{exact:true})).toBeVisible();await expect(page.getByTestId('lifetime-completions')).toHaveText('1');
 await page.getByRole('button',{name:'Remove photo',exact:true}).click();await expect(page.getByAltText('Your profile',{exact:true})).toHaveCount(0);
});
test('rejects an invalid photo without losing the saved profile',async()=>{
 const file=path.join(profile,'invalid.png');await fs.writeFile(file,'not an image');await page.getByRole('button',{name:'Open profile',exact:true}).click();await app.evaluate(({dialog},filename)=>{dialog.showOpenDialog=(async()=>({canceled:false,filePaths:[filename]}))as any;},file);await page.getByRole('button',{name:'Upload photo',exact:true}).click();await expect(page.getByRole('alert')).toContainText('valid PNG');await expect(page.getByLabel('Username',{exact:true})).toHaveValue('Student');
});
test('crop preview saves the chosen region only on confirmation and cancel preserves it',async({},testInfo)=>{
 const filename=path.join(profile,'crop-fixture.png');
 await sharp({create:{width:600,height:200,channels:3,background:'#ff0000'}}).composite([{input:await sharp({create:{width:200,height:200,channels:3,background:'#0000ff'}}).png().toBuffer(),left:400,top:0}]).png().toFile(filename);
 await page.getByRole('button',{name:'Open profile',exact:true}).click();await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=(async()=>({canceled:false,filePaths:[file]}))as any;},filename);
 await page.getByRole('button',{name:'Upload photo',exact:true}).click();await expect(page.getByRole('dialog',{name:'Crop your profile photo'})).toBeVisible();expect((await page.evaluate(()=>window.lime.call<Snapshot>('snapshot'))).profile?.avatar).toBeNull();
 const horizontal=page.getByLabel('Horizontal position',{exact:true});await horizontal.focus();await page.keyboard.press('ArrowRight');await expect(horizontal).toHaveValue('0.51');
 const box=(await page.locator('.crop-preview').boundingBox())!;await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2-50,box.y+box.height/2);await page.mouse.up();expect(Number(await horizontal.inputValue())).toBeGreaterThan(0.51);
 expect(await page.locator('.crop-preview').evaluate(node=>getComputedStyle(node).borderTopLeftRadius)).toBe('50%');expect(Math.abs(box.width-box.height)).toBeLessThan(1);
 await page.getByRole('button',{name:'Reset crop',exact:true}).click();await expect(horizontal).toHaveValue('0.5');await expect(page.getByLabel('Photo zoom',{exact:true})).toHaveValue('1');
 await page.getByLabel('Photo zoom',{exact:true}).fill('2');await page.getByLabel('Horizontal position',{exact:true}).fill('1');await page.getByLabel('Vertical position',{exact:true}).fill('1');
 expect((await new AxeBuilder({page}).setLegacyMode().withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);await page.screenshot({path:testInfo.outputPath('crop-preview.png')});await page.getByRole('button',{name:'Save photo',exact:true}).click();
 const saved=(await page.evaluate(()=>window.lime.call<Snapshot>('snapshot'))).profile!.avatar!;const image=sharp(Buffer.from(saved.split(',')[1],'base64'));expect(await image.metadata()).toMatchObject({width:128,height:128});const pixels=await image.raw().toBuffer();expect([...pixels.subarray(0,3)]).toEqual([0,0,255]);
 await page.getByRole('button',{name:'Upload photo',exact:true}).click();await page.getByLabel('Horizontal position',{exact:true}).fill('0');await page.getByRole('button',{name:'Cancel',exact:true}).click();expect((await page.evaluate(()=>window.lime.call<Snapshot>('snapshot'))).profile!.avatar).toBe(saved);
 await page.getByRole('button',{name:'Upload photo',exact:true}).click();await page.keyboard.press('Escape');expect((await page.evaluate(()=>window.lime.call<Snapshot>('snapshot'))).profile!.avatar).toBe(saved);
 await app.close();await launch();expect((await page.evaluate(()=>window.lime.call<Snapshot>('snapshot'))).profile!.avatar).toBe(saved);
});
test('shows identical circular photo framing in the header, navigation and profile after restart',async({},testInfo)=>{
 const filename=path.join(profile,'avatar-quadrants.png');
 const tiles=await Promise.all(['#ed476f','#f7c85a','#5acaac','#7ba5ff'].map(background=>sharp({create:{width:128,height:128,channels:3,background}}).png().toBuffer()));
 await sharp({create:{width:256,height:256,channels:3,background:'#000000'}}).composite(tiles.map((input,i)=>({input,left:(i%2)*128,top:Math.floor(i/2)*128}))).png().toFile(filename);
 await page.getByRole('button',{name:'View your profile',exact:true}).click();
 await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=(async()=>({canceled:false,filePaths:[file]}))as any;},filename);
 await page.getByRole('button',{name:'Upload photo',exact:true}).click();await page.getByRole('button',{name:'Save photo',exact:true}).click();
 async function geometry(){return page.locator('.avatar:has(img)').evaluateAll(nodes=>nodes.map(node=>{
   const image=node.querySelector('img')!,style=getComputedStyle(node),imageStyle=getComputedStyle(image),box=node.getBoundingClientRect(),photo=image.getBoundingClientRect();
   return{source:image.getAttribute('src'),radius:style.borderTopLeftRadius,padding:[style.paddingTop,style.paddingRight,style.paddingBottom,style.paddingLeft],width:box.width,height:box.height,imageWidth:photo.width,imageHeight:photo.height,contentWidth:box.width-parseFloat(style.borderLeftWidth)-parseFloat(style.borderRightWidth),contentHeight:box.height-parseFloat(style.borderTopWidth)-parseFloat(style.borderBottomWidth),fit:imageStyle.objectFit,position:imageStyle.objectPosition};
 }));}
 async function verify(){const photos=await geometry();expect(photos).toHaveLength(3);expect(new Set(photos.map(p=>p.source)).size).toBe(1);
  for(const photo of photos){expect(photo.radius).toBe('50%');expect(photo.padding).toEqual(Array(4).fill('0px'));expect(Math.abs(photo.width-photo.height)).toBeLessThan(1);expect(Math.abs(photo.imageWidth-photo.contentWidth)).toBeLessThan(1);expect(Math.abs(photo.imageHeight-photo.contentHeight)).toBeLessThan(1);expect(photo.fit).toBe('cover');expect(photo.position).toBe('50% 50%');}
 }
 await verify();await page.screenshot({path:testInfo.outputPath('circular-avatar-locations.png')});await app.close();await launch();await page.getByRole('button',{name:'Open profile',exact:true}).click();await verify();
});
test('centers profile gutters with no overflow at wide and narrow widths and removes the personal-workspace chevron',async({},testInfo)=>{
 await page.getByRole('button',{name:'Open profile',exact:true}).click();expect(await page.locator('.profile-button > svg').count()).toBe(0);
 await page.getByLabel('Username',{exact:true}).fill('W'.repeat(100));await page.getByRole('button',{name:'Save profile',exact:true}).click();
 for(const width of [1600,1000,800]){
  await app.evaluate(({BrowserWindow},w)=>BrowserWindow.getAllWindows()[0].setSize(w,900),width);
  const geometry=await page.evaluate(()=>{const workspace=document.querySelector('.workspace')!.getBoundingClientRect(),container=document.querySelector('.profile-page')!.getBoundingClientRect(),card=document.querySelector('.profile-card')!.getBoundingClientRect(),heading=document.querySelector('.page-heading')!.getBoundingClientRect();return {left:container.left-workspace.left,right:workspace.right-container.right,gutter:card.left-container.left,heading:heading.left,container:container.left,overflow:document.documentElement.scrollWidth>innerWidth};});
  expect(Math.abs(geometry.left-geometry.right)).toBeLessThan(2);expect(geometry.gutter).toBeGreaterThanOrEqual(20);expect(geometry.heading).toBe(geometry.container);expect(geometry.overflow).toBe(false);
  await page.screenshot({path:testInfo.outputPath(`centered-profile-${width}.png`)});
 }
});
test('applies all presets, caps custom palettes at three, edits and deletes them, and survives restart',async()=>{
 await page.getByRole('button',{name:'Settings',exact:true}).click();
 for(const [name,id]of [['Black & white','mono'],['Navy & gold','navy'],['Purple & black','purple']]){await page.getByRole('button',{name,exact:true}).click();await expect(page.locator('html')).toHaveAttribute('data-appearance',id);}
 for(let i=1;i<=3;i++){await page.getByRole('button',{name:'Create custom theme',exact:true}).click();await page.getByLabel('Theme name',{exact:true}).fill(`Saved theme ${i}`);await page.getByLabel('accent hex color',{exact:true}).fill('#edc568');await page.getByRole('button',{name:'Save and apply theme',exact:true}).click();await expect(page.getByRole('button',{name:`Saved theme ${i}`,exact:true})).toHaveAttribute('aria-pressed','true');}
 await expect(page.getByRole('button',{name:'Create custom theme',exact:true})).toBeDisabled();await app.close();await launch();await page.getByRole('button',{name:'Settings',exact:true}).click();await expect(page.getByRole('button',{name:'Saved theme 3',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'Edit theme Saved theme 2',exact:true}).click();await page.getByLabel('Theme name',{exact:true}).fill('Edited theme');await page.getByRole('button',{name:'Save and apply theme',exact:true}).click();await expect(page.getByRole('button',{name:'Edited theme',exact:true})).toHaveAttribute('aria-pressed','true');await page.getByRole('button',{name:'Delete theme Edited theme',exact:true}).click();await expect(page.getByRole('button',{name:'Purple & black',exact:true})).toHaveAttribute('aria-pressed','true');await expect(page.getByRole('button',{name:'Create custom theme',exact:true})).toBeEnabled();
});
test('profile and preset appearance remain accessible at narrow width',async({},testInfo)=>{
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1000,900));await page.getByRole('button',{name:'View your profile',exact:true}).click();expect((await new AxeBuilder({page}).setLegacyMode().withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
 await page.screenshot({path:testInfo.outputPath('profile.png')});await page.getByRole('button',{name:'Settings',exact:true}).click();for(const name of ['Black & white','Navy & gold']){await page.getByRole('button',{name,exact:true}).click();expect((await new AxeBuilder({page}).setLegacyMode().withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);await page.screenshot({path:testInfo.outputPath(`${name==='Black & white'?'mono':'navy'}.png`)});}
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(800,850));await page.getByRole('button',{name:'Create custom theme',exact:true}).click();await expect(page.getByLabel('Theme name',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Save and apply theme',exact:true}).scrollIntoViewIfNeeded();await expect(page.getByRole('button',{name:'Save and apply theme',exact:true})).toBeInViewport();
});
test('keeps a custom light palette readable and preserves unsaved theme cancellation',async()=>{
 await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'Create custom theme',exact:true}).click();await page.getByLabel('Theme name',{exact:true}).fill('Light workspace');await page.getByLabel('background hex color',{exact:true}).fill('#ffffff');await page.getByLabel('surface hex color',{exact:true}).fill('#f3f4f6');await page.getByLabel('accent hex color',{exact:true}).fill('#254d8c');await page.getByRole('button',{name:'Save and apply theme',exact:true}).click();await expect(page.getByRole('button',{name:'Light workspace',exact:true})).toHaveAttribute('aria-pressed','true');expect((await new AxeBuilder({page}).setLegacyMode().withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
 await page.getByRole('button',{name:'Edit theme Light workspace',exact:true}).click();await page.getByLabel('Theme name',{exact:true}).fill('Unsaved name');await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.getByRole('button',{name:'Light workspace',exact:true})).toHaveAttribute('aria-pressed','true');
});
