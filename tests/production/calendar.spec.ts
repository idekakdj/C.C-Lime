import { test, expect, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { DateTime } from 'luxon';
import { makeItem, type Snapshot } from '../../src/shared/model';
import { acceptanceCopy, startDesktop } from './desktop.mjs';

let copy: Awaited<ReturnType<typeof acceptanceCopy>>;
test.beforeAll(async () => { copy = await acceptanceCopy(); });
async function fixture(page: Page) {
  await page.setViewportSize({ width: 1600, height: 1000 });
  const date = await page.locator('.day-cell.today [data-day]').getAttribute('data-day');
  expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  const state = await page.evaluate(() => window.lime.call<Snapshot>('snapshot'));
  return { date: date!, zone: state.displayZone! };
}
async function summary(info: TestInfo, observed: Record<string, unknown>) {
  await fs.writeFile(info.outputPath('summary.json'), JSON.stringify({ version: copy.version, packageSha256: copy.packageSha256, ...observed,
    normalExit: true, nodeCliInspect: false,
    scope: 'Unreleased source-work package; synthetic local profile, ordinary bridge and actual renderer controls. No owner account, main-process evaluation, native dialogs or physical window sizing.' }, null, 2));
}

test('month labels spell out am and pm and retain selected time format after normal restart', async ({}, info) => {
  const profile = path.join(copy.root, 'calendar-time-labels'); let desktop = await startDesktop(copy, profile);
  try {
    let page = desktop.page; const { date, zone } = await fixture(page);
    const clocks = ['00:00', '08:30', '12:00', '20:30'];
    const values = clocks.map((clock, i) => {
      const value = makeItem(randomUUID(), date, zone); value.title = `Clock sample ${i}`;
      const start = DateTime.fromISO(`${date}T${clock}`, { zone });
      value.timing = { mode: 'timed', start: start.toUTC().toISO()!, end: start.plus({ minutes: 30 }).toUTC().toISO()!, zone };
      return value;
    });
    // Separate days keep all four labels visible despite the three-item month cap.
    values[3].timing = { ...values[3].timing, start: DateTime.fromISO(`${date}T20:30`, { zone }).plus({ days: 1 }).toUTC().toISO()!, end: DateTime.fromISO(`${date}T21:00`, { zone }).plus({ days: 1 }).toUTC().toISO()! } as typeof values[3]['timing'];
    await page.evaluate(async items => { for (const item of items) await window.lime.call('save', item); }, values);
    const label = (i: number) => page.locator('.calendar-event').filter({ hasText: `Clock sample ${i}` }).locator('small');
    for (const [i, text] of ['12am', '8:30am', '12pm', '8:30pm'].entries()) await expect(label(i)).toHaveText(text);
    await page.locator('.calendar-event').filter({ hasText: 'Clock sample 0' }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath('explicit-am-pm.png') });
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('combobox', { name: 'Time format', exact: true }).selectOption('24');
    await page.getByRole('button', { name: 'Calendar', exact: true }).click();
    for (const [i, text] of ['00', '08:30', '12', '20:30'].entries()) await expect(label(i)).toHaveText(text);
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('combobox', { name: 'Time format', exact: true }).selectOption('12');
    await page.getByRole('button', { name: 'Calendar', exact: true }).click(); await expect(label(3)).toHaveText('8:30pm');
    await desktop.close(); desktop = await startDesktop(copy, profile); page = desktop.page; await fixture(page);
    for (const [i, text] of ['12am', '8:30am', '12pm', '8:30pm'].entries()) await expect(label(i)).toHaveText(text);
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await expect(page.getByRole('combobox', { name: 'Time format', exact: true })).toHaveValue('12');
  } finally { await desktop.close(); }
  await summary(info, { midnightMorningNoonEvening: true, twentyFourHourUnchanged: true, timePreferenceRestart: true });
});

test('crowded days page all 57 saved events and preserve a final-row edit after restart', async ({}, info) => {
  const profile = path.join(copy.root, 'crowded-calendar'); let desktop = await startDesktop(copy, profile);
  try {
    let page = desktop.page; const { date, zone } = await fixture(page);
    const values = Array.from({ length: 57 }, (_, i) => ({ ...makeItem(randomUUID(), date, zone), title: `Crowded ${String(i).padStart(2, '0')}` }));
    await page.evaluate(async items => { for (const item of items) await window.lime.call('save', item); }, values);
    const cell = page.locator('.day-cell').filter({ has: page.locator(`[data-day="${date}"]`) });
    await expect(cell.locator('.calendar-event')).toHaveCount(3); await expect(cell.getByRole('button', { name: '+54 more', exact: true })).toBeVisible();
    await cell.getByRole('button', { name: '+54 more', exact: true }).click(); const panel = page.locator(`#day-panel-${date}`);
    await expect(panel.locator('.item-row')).toHaveCount(50); await panel.getByRole('button', { name: 'Show 7 more items', exact: true }).click();
    await expect(panel.locator('.item-row')).toHaveCount(57);
    const titles = await panel.locator('.item-row').allTextContents();
    for (const value of values) expect(titles.filter(text => text.includes(value.title))).toHaveLength(1);
    await panel.getByRole('button', { name: /Crowded 56/ }).click();
    await page.getByRole('dialog').getByLabel('Title', { exact: true }).fill('Crowded final edited');
    await page.getByRole('button', { name: 'Save changes', exact: true }).click(); await expect(page.getByRole('dialog')).toHaveCount(0);
    await desktop.close(); desktop = await startDesktop(copy, profile); page = desktop.page; await fixture(page);
    await page.locator(`[data-day="${date}"]`).click();
    const restartedPanel = page.locator(`#day-panel-${date}`); await restartedPanel.getByRole('button', { name: 'Show 7 more items', exact: true }).click();
    await expect(restartedPanel.locator('.item-row')).toHaveCount(57); await expect(restartedPanel.getByText('Crowded final edited', { exact: true })).toBeVisible();
  } finally { await desktop.close(); }
  await summary(info, { boundedInitialRendering: 50, everySavedItemReachable: 57, monthOverflowControl: true, finalRowEditRestart: true });
});

test('large task lists retain final-row completion across refresh, sign-out and normal restart', async ({}, info) => {
  const profile = path.join(copy.root, 'large-task-list'); let desktop = await startDesktop(copy, profile);
  try {
    let page = desktop.page; const { date, zone } = await fixture(page);
    const values = Array.from({ length: 57 }, (_, i) => ({ ...makeItem(randomUUID(), date, zone, 'task'), title: `Task batch ${String(i).padStart(2, '0')}`, timing: { mode: 'unscheduled' as const, zone } }));
    await page.evaluate(async items => { for (const item of items) await window.lime.call('save', item); }, values);
    await page.getByRole('button', { name: 'My tasks', exact: true }).click();
    const section = page.locator('.task-section').filter({ has: page.getByRole('heading', { name: /No due date/ }) });
    await expect(section.locator('.item-row')).toHaveCount(50); await section.getByRole('button', { name: 'Show 7 more items', exact: true }).click();
    await expect(section.locator('.item-row')).toHaveCount(57); await section.getByRole('button', { name: 'Complete Task batch 56', exact: true }).click();
    await expect(section.locator('.item-row')).toHaveCount(56); await page.getByRole('button', { name: 'Completed', exact: true }).click();
    await expect(page.locator('.tasks-page .item-row')).toHaveCount(1); await expect(page.getByText('Task batch 56', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Calendar', exact: true }).click(); await page.getByRole('button', { name: 'Next period', exact: true }).click(); await page.getByRole('button', { name: 'Previous period', exact: true }).click();
    await page.getByRole('button', { name: 'My tasks', exact: true }).click(); await expect(page.getByText('Task batch 56', { exact: true })).toBeVisible();
    await page.evaluate(() => window.lime.call('auth.signOut')); await expect(page.getByRole('button', { name: /Explore a local calendar/ })).toBeVisible(); await expect(page.getByText('Task batch 56', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: /Explore a local calendar/ }).click(); await page.getByRole('button', { name: 'My tasks', exact: true }).click(); await expect(page.getByText('Task batch 56', { exact: true })).toBeVisible();
    await desktop.close(); desktop = await startDesktop(copy, profile); page = desktop.page; await fixture(page);
    await page.getByRole('button', { name: 'My tasks', exact: true }).click(); await page.getByRole('button', { name: 'Completed', exact: true }).click();
    await expect(page.locator('.tasks-page .item-row')).toHaveCount(1); await expect(page.getByText('Task batch 56', { exact: true })).toBeVisible();
  } finally { await desktop.close(); }
  await summary(info, { fiftyToFiftySevenPaging: true, completedSeparatedFromOpen: true, viewRefresh: true, signOutHidesLocalRecords: true, localReentryAndRestart: true });
});

test('calendar keyboard, notes search, alternate views and narrow drawers work without main inspection', async ({}, info) => {
  const desktop = await startDesktop(copy, path.join(copy.root, 'calendar-keyboard'));
  try {
    const page = desktop.page; const { date, zone } = await fixture(page);
    const value = makeItem(randomUUID(), date, zone); value.title = 'A searchable seminar'; value.notes = 'quartz meeting';
    await page.evaluate(item => window.lime.call('save', item), value); await expect(page.locator('.calendar-event').filter({ hasText: value.title })).toBeVisible();
    await page.locator(`[data-day="${date}"]`).focus(); await page.keyboard.press('Enter'); await expect(page.locator(`#day-panel-${date}`)).toBeVisible();
    await page.keyboard.press('Escape'); await expect(page.locator(`#day-panel-${date}`)).toHaveCount(0);
    await page.locator(`[data-day="${date}"]`).focus(); await page.keyboard.press('ArrowRight');
    await expect(page.locator(`[data-day="${DateTime.fromISO(date).plus({ days: 1 }).toISODate()}"]`)).toBeFocused();
    await page.keyboard.press('Control+f'); await expect(page.getByRole('textbox', { name: 'Search your calendar', exact: true })).toBeFocused(); await page.keyboard.type('quartz');
    await expect(page.locator('.search-results').getByRole('button', { name: /A searchable seminar/ })).toBeVisible(); await page.getByRole('button', { name: 'Clear search', exact: true }).click();
    await page.getByRole('button', { name: 'Week', exact: true }).click(); await expect(page.locator('.week-view')).toBeVisible();
    await page.getByRole('button', { name: 'Agenda', exact: true }).click(); await expect(page.locator('.agenda-list')).toBeVisible();
    await page.getByRole('button', { name: 'Month', exact: true }).click(); await expect(page.locator('.month-calendar')).toBeVisible();
    await page.setViewportSize({ width: 800, height: 850 }); await expect.poll(() => page.evaluate(() => window.innerWidth)).toBe(800);
    await page.getByRole('button', { name: 'Open navigation', exact: true }).click(); await expect(page.getByRole('button', { name: 'My tasks', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Close navigation', exact: true }).click(); await page.getByRole('button', { name: 'Show upcoming tasks', exact: true }).click();
    await expect(page.getByRole('complementary', { name: 'Upcoming tasks for the next 7 days' })).toBeVisible();
    await page.screenshot({ path: info.outputPath('narrow-upcoming-drawer.png') });
    await page.getByRole('button', { name: 'Close upcoming tasks', exact: true }).last().click(); await expect(page.getByRole('button', { name: 'Show upcoming tasks', exact: true })).toBeVisible();
  } finally { await desktop.close(); }
  await summary(info, { keyboardDayAndFocus: true, notesSearch: true, threeViews: true, measuredRendererWidth: 800, navigationAndUpcomingDrawers: true });
});
