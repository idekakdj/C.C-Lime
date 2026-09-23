import { randomUUID } from 'node:crypto';
import { DateTime } from 'luxon';
import { itemSchema, recurrenceSchema, type CalendarItem } from '../src/shared/model';
export function item(patch: Partial<CalendarItem> = {}): CalendarItem { return itemSchema.parse({ id: randomUUID(), kind: 'item', title: 'Algorithms lecture', itemType: 'event', timing: { mode: 'timed', start: '2026-09-18T13:00:00Z', end: '2026-09-18T14:00:00Z', zone: 'America/Toronto' }, ...patch }); }
export function recurrence(patch = {}) { return recurrenceSchema.parse({ frequency: 'WEEKLY', weekdays: [5], ...patch }); }
export function millis(iso: string, zone = 'America/Toronto') { return DateTime.fromISO(iso, { zone }).toMillis(); }
