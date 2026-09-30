import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Snapshot } from '../../src/shared/model';
let app:ElectronApplication,page:Page,profile:string;
const executable=process.env.CC_LIME_TEST_EXECUTABLE??path.resolve('out/C.C. Lime-win32-x64/cc-lime.exe');
async function launch(){app=await electron.launch({executablePath:executable,args:[`--cc-lime-test-profile=${profile}`],timeout:60000});page=await app.firstWindow();await page.getByRole('button',{name:/Explore a local calendar/}).click();await expect(page.getByRole('heading',{name:'Your calendar',exact:true})).toBeVisible();if(!(await page.evaluate(()=>window.lime.call<Snapshot>('snapshot'))).device.onboardingDone)await page.getByRole('button',{name:'Use defaults'}).click();}
test.beforeEach(async()=>{profile=path.resolve('test-results/profiles',`profile-${randomUUID()}`);await launch();});
test.afterEach(async()=>{await app?.close();});
test('uploads, persists, removes a profile icon and keeps lifetime progress after task deletion',async()=>{
 await page.getByRole('button',{name:'Open profile',exact:true}).click();await page.getByLabel('Display name',{exact:true}).fill('Taylor Student');await page.getByRole('button',{name:'Save profile',exact:true}).click();
 await app.evaluate(({dialog},filename)=>{dialog.showOpenDialog=(async()=>({canceled:false,filePaths:[filename]}))as any;},path.resolve('assets/icon.png'));
 await page.getByRole('button',{name:'Upload photo',exact:true}).click();await expect(page.getByAltText('Your profile',{exact:true})).toBeVisible();
 const taskId=randomUUID();await page.evaluate(async id=>{await window.lime.call('save',{id,kind:'item',title:'Completed progress fixture',itemType:'task',timing:{mode:'unscheduled',zone:'UTC'},status:'open'});await window.lime.call('complete',{id,completed:true});await window.lime.call('remove',{id});},taskId);
 await expect(page.getByTestId('lifetime-completions')).toHaveText('1');await app.close();await launch();await page.getByRole('button',{name:'Open profile',exact:true}).click();await expect(page.getByLabel('Display name',{exact:true})).toHaveValue('Taylor Student');await expect(page.getByAltText('Your profile',{exact:true})).toBeVisible();await expect(page.getByTestId('lifetime-completions')).toHaveText('1');
 await page.getByRole('button',{name:'Remove photo',exact:true}).click();await expect(page.getByAltText('Your profile',{exact:true})).toHaveCount(0);
});
test('rejects an invalid photo without losing the saved profile',async()=>{
 const file=path.join(profile,'invalid.png');await fs.writeFile(file,'not an image');await page.getByRole('button',{name:'Open profile',exact:true}).click();await app.evaluate(({dialog},filename)=>{dialog.showOpenDialog=(async()=>({canceled:false,filePaths:[filename]}))as any;},file);await page.getByRole('button',{name:'Upload photo',exact:true}).click();await expect(page.getByRole('alert')).toContainText('valid PNG');await expect(page.getByLabel('Display name',{exact:true})).toHaveValue('Student');
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
