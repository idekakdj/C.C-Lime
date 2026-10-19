import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { item } from '../fixtures';
import type { Snapshot } from '../../src/shared/model';
import { rendererCopy, startDesktop } from './desktop.mjs';

let copy:Awaited<ReturnType<typeof rendererCopy>>;
test.beforeAll(async()=>{copy=await rendererCopy();});
test('complete time-zone suggestions save fractional offsets, retain event instants and survive restart',async({},info)=>{
  const profile=path.join(copy.root,'all-time-zones');let desktop=await startDesktop(copy,profile);
  try {
    let page=desktop.page;
    const today=await page.locator('.day-cell.today [data-day]').getAttribute('data-day');expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const event=item({title:'Time-zone persistence fixture',timing:{mode:'timed',start:`${today}T12:00:00Z`,end:`${today}T13:00:00Z`,zone:'UTC'}});
    await page.evaluate(record=>window.lime.call('save',record),event);
    await page.getByRole('button',{name:'Settings',exact:true}).click();
    const coverage=await page.evaluate(()=>({listed:Array.from(document.querySelectorAll<HTMLOptionElement>('#zones option')).map(option=>option.value),runtime:Intl.supportedValuesOf('timeZone')}));
    expect(coverage.runtime.every(zone=>coverage.listed.includes(zone))).toBe(true);
    expect(coverage.listed).toEqual(expect.arrayContaining(['Africa/Nairobi','Antarctica/Troll','Australia/Eucla','Pacific/Chatham','Etc/GMT-14','Etc/GMT+12','UTC']));
    await page.getByLabel('Follow this computer’s time zone').uncheck();
    const input=page.getByRole('combobox',{name:/^Calendar time zone/});await expect(input).toBeEnabled();
    await page.getByRole('combobox',{name:'Time format',exact:true}).selectOption('24');
    await input.fill('Australia/Eucla');await page.getByRole('button',{name:'Apply',exact:true}).click();
    await expect(page.getByRole('status').filter({hasText:'Currently displaying Australia/Eucla'})).toBeVisible();
    let snapshot=await page.evaluate(()=>window.lime.call<Snapshot>('snapshot'));expect(snapshot.displayZone).toBe('Australia/Eucla');expect(snapshot.records.find(r=>r.id===event.id)).toEqual(event);
    await page.getByRole('button',{name:'Calendar',exact:true}).click();await expect(page.locator('.calendar-event').filter({hasText:event.title}).locator('small')).toHaveText('20:45');
    await desktop.close();desktop=await startDesktop(copy,profile);page=desktop.page;
    await expect(page.locator('.calendar-event').filter({hasText:event.title}).locator('small')).toHaveText('20:45');
    await page.getByRole('button',{name:'Settings',exact:true}).click();await expect(page.getByRole('combobox',{name:/^Calendar time zone/})).toHaveValue('Australia/Eucla');await expect(page.getByLabel('Follow this computer’s time zone')).not.toBeChecked();
    // A legacy alias can be entered even when the runtime enumerates a newer name.
    await page.getByRole('combobox',{name:/^Calendar time zone/}).fill('US/Eastern');await page.getByRole('button',{name:'Apply',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Currently displaying US/Eastern'})).toBeVisible();
    snapshot=await page.evaluate(()=>window.lime.call<Snapshot>('snapshot'));expect(snapshot.records.find(r=>r.id===event.id)).toEqual(event);
    await fs.writeFile(info.outputPath('summary.json'),JSON.stringify({version:copy.version,fixturePolicy:copy.policy,runtimeZones:coverage.runtime.length,listedZones:coverage.listed.length,allRuntimeZonesListed:true,fractionalOffsetRendered:true,restart:true,savedAliasAccepted:true,originalInstantPreserved:true},null,2));
  } finally {await desktop.close();}
});
