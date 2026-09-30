import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
// JavaScript fixture deliberately starts the executable without Electron's inspector launcher.
import { acceptanceCopy, startDesktop } from './desktop.mjs';
let copy: Awaited<ReturnType<typeof acceptanceCopy>>;
test.beforeAll(async () => { copy = await acceptanceCopy(); });

test('calendar edits and local profile appearance survive an independently launched restart', async ({}, testInfo) => {
  const profile = path.join(copy.root, 'calendar-profile');
  let desktop = await startDesktop(copy, profile);
  try {
    let page = desktop.page;
    await page.getByRole('button', { name: 'Add item', exact: true }).first().click();
    const editor = page.getByRole('dialog');
    await editor.getByLabel('Title', { exact: true }).fill('Independent acceptance event');
    await editor.getByRole('button', { name: 'Add to calendar' }).click();
    await expect(editor).not.toBeVisible();
    await page.locator('.calendar-event').filter({ hasText: 'Independent acceptance event' }).first().click();
    await editor.getByLabel('Title', { exact: true }).fill('Independent accepted edit');
    await editor.getByRole('button', { name: 'Save changes' }).click();
    await expect(editor).not.toBeVisible();
    await page.getByRole('button', { name: 'Open profile', exact: true }).click();
    await page.getByLabel('Display name', { exact: true }).fill('Independent student');
    await page.getByRole('button', { name: 'Save profile', exact: true }).click();
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('button', { name: 'Navy & gold', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-appearance', 'navy');
    await desktop.close(); desktop = await startDesktop(copy, profile); page = desktop.page;
    await expect(page.locator('.calendar-event').filter({ hasText: 'Independent accepted edit' }).first()).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-appearance', 'navy');
    await page.getByRole('button', { name: 'Open profile', exact: true }).click();
    await expect(page.getByLabel('Display name', { exact: true })).toHaveValue('Independent student');
    await fs.writeFile(testInfo.outputPath('summary.json'), JSON.stringify({ version: copy.version, calendarCreatedAndEdited: true,
      nameAndThemePreserved: true, restart: true, nodeCliInspect: false, scope: 'Renderer/local durability only; no main-process stubs or real account.' }, null, 2));
  } finally { await desktop.close(); }
});

test('404 recovery retains saved calendar and exposes no renderer Node API', async ({}, testInfo) => {
  const desktop = await startDesktop(copy, path.join(copy.root, 'boundary-profile'));
  try {
    const page = desktop.page;
    expect(await page.evaluate(() => ({ node: typeof (window as any).require, process: typeof (window as any).process }))).toEqual({ node: 'undefined', process: 'undefined' });
    await expect(page.evaluate(() => window.lime.call('unsupported.acceptance-command'))).rejects.toThrow('not supported');
    await page.getByRole('button', { name: 'Add item', exact: true }).first().click();
    await page.getByRole('dialog').getByLabel('Title', { exact: true }).fill('Before missing page');
    await page.getByRole('dialog').getByRole('button', { name: 'Add to calendar' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    const response = await page.goto('cclime://app/missing-production-acceptance?private=do-not-reflect');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: 'Page not found', exact: true })).toBeVisible();
    await expect(page.locator('body')).not.toContainText('do-not-reflect');
    await expect(page.evaluate(() => window.lime.call('snapshot'))).rejects.toThrow('Invalid sender');
    await page.getByRole('link', { name: 'Return to calendar', exact: true }).click();
    await expect(page.locator('.calendar-event').filter({ hasText: 'Before missing page' }).first()).toBeVisible();
    await fs.writeFile(testInfo.outputPath('summary.json'), JSON.stringify({ version: copy.version, secure404Recovery: true,
      rendererNodeUnavailable: true, unknownCommandDenied: true, nodeCliInspect: false, scope: 'Renderer observations; no main-process sandbox-policy inspection.' }, null, 2));
  } finally { await desktop.close(); }
});
