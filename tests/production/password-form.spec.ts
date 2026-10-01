import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { acceptanceCopy, startDesktop } from './desktop.mjs';

test('new-password feedback and confirmation clear when returning to sign-in without browser credential storage',async({},testInfo)=>{
 const copy=await acceptanceCopy(),desktop=await startDesktop(copy,path.join(copy.root,'password-form'));
 try {
  const page=desktop.page;await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'Return to sign-in',exact:true}).click();await page.getByRole('button',{name:'Sign out',exact:true}).click();
  await expect(page.getByLabel('Password',{exact:true})).toBeVisible();await expect(page.getByLabel('Confirm new password',{exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Create an account',exact:true}).click();await page.getByLabel('New password',{exact:true}).fill('short');await expect(page.getByRole('status').filter({hasText:'Weak.'})).toBeVisible();
  await page.getByLabel('New password',{exact:true}).fill('Synthetic violet river 47');await page.getByLabel('Confirm new password',{exact:true}).fill('different');await expect(page.getByRole('status').filter({hasText:'must match'})).toBeVisible();
  await page.getByLabel('Confirm new password',{exact:true}).fill('Synthetic violet river 47');await expect(page.getByRole('status').filter({hasText:'must match'})).toHaveCount(0);
  expect((await new AxeBuilder({page}).setLegacyMode().withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
  await page.getByRole('button',{name:'Back to sign in',exact:true}).click();await expect(page.getByLabel('Password',{exact:true})).toHaveValue('');await expect(page.getByLabel('Confirm new password',{exact:true})).toHaveCount(0);
  expect(await page.evaluate(()=>({local:localStorage.length,session:sessionStorage.length,node:typeof (window as unknown as {require?:unknown}).require}))).toEqual({local:0,session:0,node:'undefined'});
 } finally {await desktop.close();}
 await fs.writeFile(testInfo.outputPath('summary.json'),JSON.stringify({version:copy.version,normalExit:true,nodeCliInspect:false,newPasswordFeedback:true,matchingConfirmation:true,signInHasNoConfirmation:true,modeChangeClearsPassword:true,browserCredentialStoresEmpty:true,automatedAccessibility:true,scope:'Independent renderer form acceptance; cloud configuration absent, no identity is created or changed.'},null,2));
});
