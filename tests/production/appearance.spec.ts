import { test, expect, type Page, type TestInfo } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { acceptanceCopy, startDesktop } from './desktop.mjs';

let copy: Awaited<ReturnType<typeof acceptanceCopy>>;
test.beforeAll(async () => { copy = await acceptanceCopy(); });

async function accessible(page: Page) {
  const result = await new AxeBuilder({ page }).setLegacyMode(true).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(result.violations.map(violation => ({ id: violation.id, targets: violation.nodes.map(node => node.target) }))).toEqual([]);
}
async function retain(testInfo: TestInfo, assertions: Record<string, unknown>) {
  await fs.writeFile(testInfo.outputPath('summary.json'), JSON.stringify({ version: copy.version, ...assertions,
    normalExit: true, nodeCliInspect: false, scope: 'Local renderer UI and measured viewport; no native dialogs, physical window resizing or account sync.' }, null, 2));
}

test('all presets and three custom slots preserve edits, deletion and slot reuse after normal restart', async ({}, testInfo) => {
  const profile = path.join(copy.root, 'custom-slots');
  let desktop = await startDesktop(copy, profile);
  try {
    let page = desktop.page;
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    for (const [name, id] of [['Black & white', 'mono'], ['Navy & gold', 'navy'], ['Purple & black', 'purple']]) {
      await page.getByRole('button', { name, exact: true }).click();
      await expect(page.locator('html')).toHaveAttribute('data-appearance', id);
    }
    for (let index = 1; index <= 3; index++) {
      await page.getByRole('button', { name: 'Create custom theme', exact: true }).click();
      await page.getByLabel('Theme name', { exact: true }).fill(`Independent theme ${index}`);
      await page.getByLabel('accent hex color', { exact: true }).fill('#edc568');
      await page.getByRole('button', { name: 'Save and apply theme', exact: true }).click();
      await expect(page.getByRole('button', { name: `Independent theme ${index}`, exact: true })).toHaveAttribute('aria-pressed', 'true');
    }
    await expect(page.getByRole('button', { name: 'Create custom theme', exact: true })).toBeDisabled();
    await desktop.close(); desktop = await startDesktop(copy, profile); page = desktop.page;
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    for (let index = 1; index <= 3; index++) await expect(page.getByRole('button', { name: `Independent theme ${index}`, exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Independent theme 3', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Create custom theme', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Edit theme Independent theme 2', exact: true }).click();
    await page.getByLabel('Theme name', { exact: true }).fill('Edited independent theme');
    await page.getByRole('button', { name: 'Save and apply theme', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Edited independent theme', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Delete theme Edited independent theme', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Purple & black', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Edited independent theme', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Create custom theme', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Create custom theme', exact: true }).click();
    await page.getByLabel('Theme name', { exact: true }).fill('Reused slot');
    await page.getByRole('button', { name: 'Save and apply theme', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Create custom theme', exact: true })).toBeDisabled();
    await desktop.close(); desktop = await startDesktop(copy, profile); page = desktop.page;
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Reused slot', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Edited independent theme', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Independent theme 1', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Independent theme 3', exact: true })).toBeVisible();
  } finally { await desktop.close(); }
  await retain(testInfo, { presets: 3, customSlotLimit: 3, slotCapAcrossRestart: true, editDeleteAndReuse: true, finalRestart: true });
});

test('custom light contrast and cancellation preserve the saved palette after restart', async ({}, testInfo) => {
  const profile = path.join(copy.root, 'light-palette');
  let desktop = await startDesktop(copy, profile);
  try {
    let page = desktop.page;
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('button', { name: 'Create custom theme', exact: true }).click();
    await page.getByLabel('Theme name', { exact: true }).fill('Independent light');
    await page.getByLabel('background hex color', { exact: true }).fill('#ffffff');
    await page.getByLabel('surface hex color', { exact: true }).fill('#f3f4f6');
    await page.getByLabel('accent hex color', { exact: true }).fill('#254d8c');
    await page.getByRole('button', { name: 'Save and apply theme', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Independent light', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await accessible(page);
    await page.screenshot({ path: testInfo.outputPath('light.png') });
    await page.getByRole('button', { name: 'Edit theme Independent light', exact: true }).click();
    await page.getByLabel('Theme name', { exact: true }).fill('Unsaved theme');
    await page.getByLabel('background hex color', { exact: true }).fill('#123456');
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Independent light', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Unsaved theme', exact: true })).toHaveCount(0);
    await desktop.close(); desktop = await startDesktop(copy, profile); page = desktop.page;
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Independent light', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Edit theme Independent light', exact: true }).click();
    await expect(page.getByLabel('background hex color', { exact: true })).toHaveValue('#ffffff');
    await expect(page.getByLabel('surface hex color', { exact: true })).toHaveValue('#f3f4f6');
    await expect(page.getByLabel('accent hex color', { exact: true })).toHaveValue('#254d8c');
  } finally { await desktop.close(); }
  await retain(testInfo, { automatedLightAccessibility: true, cancelPreservesNameAndColors: true, restart: true });
});

test('profile and preset controls remain accessible at measured narrow renderer sizes', async ({}, testInfo) => {
  const desktop = await startDesktop(copy, path.join(copy.root, 'narrow-appearance'));
  try {
    const page = desktop.page;
    await page.setViewportSize({ width: 1000, height: 900 });
    expect(await page.evaluate(() => ({ width: innerWidth, height: innerHeight }))).toEqual({ width: 1000, height: 900 });
    await page.getByRole('button', { name: 'View your profile', exact: true }).click();
    await expect(page.getByLabel('Display name', { exact: true })).toBeVisible();
    await accessible(page); await page.screenshot({ path: testInfo.outputPath('profile.png') });
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    for (const [name, file] of [['Black & white', 'mono'], ['Navy & gold', 'navy']]) {
      await page.getByRole('button', { name, exact: true }).click();
      await accessible(page); await page.screenshot({ path: testInfo.outputPath(`${file}.png`) });
    }
    await page.setViewportSize({ width: 800, height: 850 });
    expect(await page.evaluate(() => ({ width: innerWidth, height: innerHeight }))).toEqual({ width: 800, height: 850 });
    await page.getByRole('button', { name: 'Create custom theme', exact: true }).click();
    await expect(page.getByLabel('Theme name', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Save and apply theme', exact: true }).scrollIntoViewIfNeeded();
    await expect(page.getByRole('button', { name: 'Save and apply theme', exact: true })).toBeInViewport();
    await page.screenshot({ path: testInfo.outputPath('custom-editor.png') });
  } finally { await desktop.close(); }
  await retain(testInfo, { measuredViewports: [{ width: 1000, height: 900 }, { width: 800, height: 850 }], automatedProfileAndPresetAccessibility: true, customEditorReachable: true });
});
