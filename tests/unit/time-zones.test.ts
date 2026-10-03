import { expect, it } from 'vitest';
import { DateTime } from 'luxon';
import { timeZoneOptions } from '../../src/renderer/time-zones';
import { zone } from '../../src/shared/model';

it('offers every enumerated runtime zone, UTC and fixed-offset extremes accepted by preferences',()=>{
  const options=timeZoneOptions();
  expect(Intl.supportedValuesOf('timeZone').every(value=>options.includes(value))).toBe(true);
  expect(options[0]).toBe('UTC');expect(new Set(options).size).toBe(options.length);
  expect(options).toEqual(expect.arrayContaining(['Africa/Nairobi','Antarctica/Troll','Australia/Eucla','Pacific/Chatham','Etc/GMT-14','Etc/GMT+12','Etc/UTC']));
  expect(options.every(value=>zone.safeParse(value).success)).toBe(true);
  expect(DateTime.fromISO('2026-01-01T12:00:00Z').setZone('Australia/Eucla').toFormat('HH:mm')).toBe('20:45');
  expect(DateTime.fromISO('2026-01-01T12:00:00Z').setZone('Etc/GMT-14').toISODate()).toBe('2026-01-02');
});
it('preserves valid saved aliases without including arbitrary or invalid names',()=>{
  const options=timeZoneOptions(['Asia/Kathmandu','US/Eastern','UTC','not/a-zone',undefined,'<script>']);
  expect(options).toEqual(expect.arrayContaining(['Asia/Kathmandu','US/Eastern']));
  expect(options).not.toContain('not/a-zone');expect(options).not.toContain('<script>');
  expect(options.filter(value=>value==='UTC')).toHaveLength(1);
});
