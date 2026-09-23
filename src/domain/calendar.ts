import { DateTime } from 'luxon';
import ICAL from 'ical.js';
import { isTask, type CalendarItem, type DomainRecord, type Occurrence, type OccurrenceException, type Recurrence, type Timing } from '../shared/model';

export const weekdays = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
export function day(date: string, zone = 'UTC'): DateTime { const result = DateTime.fromISO(date, { zone }).startOf('day'); if (!result.isValid) throw new Error('Invalid calendar date.'); return result; }
export function addDays(date: string, amount: number): string { return day(date).plus({ days: amount }).toISODate()!; }
export function localInstant(date: string, time: string, zone: string, later = false): DateTime {
  const parsed = DateTime.fromISO(`${date}T${time}`, { zone });
  if (!parsed.isValid || parsed.toFormat('yyyy-MM-dd HH:mm') !== `${date} ${time}`) throw new Error('This local time does not exist because the clocks change. Choose another time.');
  const candidates = parsed.getPossibleOffsets().sort((a, b) => a.toMillis() - b.toMillis());
  return candidates[later ? candidates.length - 1 : 0] ?? parsed;
}
export function sourceDate(timing: Timing): string | null {
  if (timing.mode === 'timed') return DateTime.fromISO(timing.start).setZone(timing.zone).toISODate();
  if (timing.mode === 'allDay') return timing.startDate;
  if (timing.mode === 'deadline') return timing.date;
  return null;
}
export function anchor(timing: Timing): number | null {
  if (timing.mode === 'timed') return DateTime.fromISO(timing.start).toMillis();
  if (timing.mode === 'allDay') return localInstant(timing.startDate, timing.anchorTime, timing.zone).toMillis();
  if (timing.mode === 'deadline') return localInstant(timing.date, timing.time ?? timing.anchorTime, timing.zone).toMillis();
  return null;
}
export function finish(timing: Timing): number | null {
  if (timing.mode === 'timed') return DateTime.fromISO(timing.end).toMillis();
  if (timing.mode === 'allDay') return day(timing.endDate, timing.zone).toMillis();
  if (timing.mode === 'deadline') return timing.time ? localInstant(timing.date, timing.time, timing.zone).toMillis() : day(timing.date, timing.zone).plus({ days: 1 }).toMillis();
  return null;
}
export function atDate(timing: Timing, date: string): Timing {
  if (timing.mode === 'timed') {
    const original = DateTime.fromISO(timing.start).setZone(timing.zone);
    const start = localInstant(date, original.toFormat('HH:mm'), timing.zone);
    return { ...timing, start: start.toUTC().toISO()!, end: start.plus({ milliseconds: DateTime.fromISO(timing.end).toMillis() - original.toMillis() }).toUTC().toISO()! };
  }
  if (timing.mode === 'allDay') return { ...timing, startDate: date, endDate: addDays(date, Math.round(day(timing.endDate).diff(day(timing.startDate), 'days').days)) };
  if (timing.mode === 'deadline') return { ...timing, date };
  return timing;
}
export function recurrenceRule(recurrence: Recurrence, firstDate: string, includeCount = true): string {
  const parts = [`FREQ=${recurrence.frequency}`, `INTERVAL=${recurrence.interval}`, 'WKST=MO'];
  if (recurrence.frequency === 'WEEKLY' && recurrence.weekdays.length) parts.push(`BYDAY=${[...new Set(recurrence.weekdays)].sort().map(n => weekdays[n - 1]).join(',')}`);
  if (recurrence.frequency === 'MONTHLY' && recurrence.monthlyMode === 'ordinal') parts.push(`BYDAY=${recurrence.ordinal}${weekdays[day(firstDate).weekday - 1]}`);
  if (recurrence.frequency === 'MONTHLY' && recurrence.monthlyMode === 'date') parts.push(`BYMONTHDAY=${day(firstDate).day}`);
  if (recurrence.frequency === 'YEARLY') parts.push(`BYMONTH=${day(firstDate).month}`, `BYMONTHDAY=${day(firstDate).day}`);
  if (includeCount && recurrence.count) parts.push(`COUNT=${recurrence.count}`);
  if (recurrence.until) parts.push(`UNTIL=${recurrence.until.replaceAll('-', '')}`);
  return parts.join(';');
}
export function recurringDates(item: CalendarItem, from: string, toExclusive: string): string[] {
  const first = sourceDate(item.timing); if (!first) return [];
  const recurrence = item.recurrence; if (!recurrence) return first >= from && first < toExclusive ? [first] : [];
  const rule = ICAL.Recur.fromString(recurrenceRule(recurrence, first, false));
  const iterator = rule.iterator(ICAL.Time.fromString(first, null));
  const result = new Set<string>(); let iterations = 0; let validCount = 0;
  while (iterations++ < 100000) {
    const next = iterator.next(); if (!next) break;
    const date = next.toString().slice(0, 10); if (date >= toExclusive || (recurrence.until && date > recurrence.until)) break;
    try { atDate(item.timing, date); } catch { continue; }
    if (recurrence.count && ++validCount > recurrence.count) break;
    if (date >= from && !recurrence.excludedDates.includes(date)) result.add(date);
  }
  if (iterations >= 100000) throw new Error('This repeating schedule is too large to expand safely.');
  for (const date of recurrence.extraDates) if (date >= from && date < toExclusive && !recurrence.excludedDates.includes(date)) result.add(date);
  return [...result].sort();
}
function occurrence(item: CalendarItem, originalDate: string, displayZone: string, exception?: OccurrenceException): Occurrence | null {
  if (exception?.cancelled) return null;
  let timing: Timing; try { timing = item.recurrence ? atDate(item.timing, originalDate) : item.timing; } catch { return null; }
  const effective = { ...item, ...exception?.override, timing: exception?.override.timing ?? timing };
  const startMs = anchor(effective.timing); const endMs = finish(effective.timing);
  let date = sourceDate(effective.timing) ?? '';
  let endDate = date;
  if (effective.timing.mode === 'timed') { date = DateTime.fromMillis(startMs!, { zone: displayZone }).toISODate()!; endDate = DateTime.fromMillis(endMs! - 1, { zone: displayZone }).toISODate()!; }
  if (effective.timing.mode === 'allDay') endDate = addDays(effective.timing.endDate, -1);
  if (effective.timing.mode === 'deadline' && effective.timing.time) date = endDate = DateTime.fromMillis(startMs!, { zone: displayZone }).toISODate()!;
  return { ...effective, originalDate, occurrenceKey: item.recurrence ? `${item.id}:${originalDate}` : item.id, seriesId: item.recurrence ? item.id : null, startMs, endMs, date, endDate };
}
export function expand(records: DomainRecord[], from: string, toExclusive: string, displayZone: string, limit = 20000): Occurrence[] {
  const exceptions = new Map<string, OccurrenceException>();
  const states = new Map(records.filter(r => r.kind === 'occurrenceState').map(r => [`${r.seriesId}:${r.originalDate}`, r]));
  for (const record of records) if (record.kind === 'exception') exceptions.set(`${record.seriesId}:${record.originalDate}`, record);
  const result: Occurrence[] = [];
  const push = (value: Occurrence | null) => {
    if (!value || value.timing.mode === 'unscheduled' || value.date >= toExclusive || value.endDate < from) return;
    const state = states.get(value.occurrenceKey);
    if (state) { value.status = state.status; value.completedAt = state.completedAt; }
    result.push(value); if (result.length > limit) throw new Error('Too many calendar occurrences. Narrow the date range.');
  };
  for (const record of records) {
    if (record.kind !== 'item') continue;
    const first = sourceDate(record.timing); if (!first) continue;
    if (!record.recurrence) { push(occurrence(record, first, displayZone)); continue; }
    const durationDays = Math.max(2, Math.ceil(((finish(record.timing) ?? 0) - (anchor(record.timing) ?? 0)) / 86400000) + 2);
    const dates = new Set(recurringDates(record, addDays(from, -durationDays), addDays(toExclusive, 2)));
    for (const exception of exceptions.values()) if (exception.seriesId === record.id && exception.override.timing) {
      const moved = sourceDate(exception.override.timing); if (moved && moved < addDays(toExclusive, 2) && moved >= addDays(from, -durationDays)) dates.add(exception.originalDate);
    }
    for (const date of dates) push(occurrence(record, date, displayZone, exceptions.get(`${record.id}:${date}`)));
  }
  return result.sort(compareOccurrences);
}
export function compareOccurrences(a: Occurrence, b: Occurrence): number {
  const modeRank = (o: Occurrence) => o.timing.mode === 'allDay' ? 0 : o.timing.mode === 'deadline' && !o.timing.time ? 2 : 1;
  return a.date.localeCompare(b.date) || modeRank(a) - modeRank(b) || (a.startMs ?? Infinity) - (b.startMs ?? Infinity) || a.title.localeCompare(b.title) || a.occurrenceKey.localeCompare(b.occurrenceKey);
}
export function isOverdue(item: Occurrence, now: number): boolean {
  const dateOnly = item.timing.mode === 'allDay' || (item.timing.mode === 'deadline' && !item.timing.time);
  return isTask(item) && item.status !== 'completed' && item.endMs !== null && (dateOnly ? item.endMs <= now : item.endMs < now);
}
export function upcoming(records: DomainRecord[], now: number, zone: string): { upcoming: Occurrence[]; overdue: Occurrence[]; nextEvent: Occurrence | null } {
  const today = DateTime.fromMillis(now, { zone }).toISODate()!; const end = addDays(today, 7);
  const nonRecurring = records.filter(r => r.kind !== 'item' || !r.recurrence);
  const historic = expand(nonRecurring, '1900-01-01', today, zone).filter(o => isOverdue(o, now));
  const recentRecurring = expand(records.filter(r => r.kind !== 'item' || (!!r.recurrence && isTask(r))), '1900-01-01', today, zone, 100000).filter(o => isOverdue(o, now));
  const visible = expand(records, today, end, zone);
  const priorityRank = { high: 0, normal: 1, low: 2 };
  const taskSort = (a: Occurrence, b: Occurrence) => a.date.localeCompare(b.date) || (a.timing.mode === 'deadline' && !a.timing.time ? Infinity : a.startMs ?? Infinity) - (b.timing.mode === 'deadline' && !b.timing.time ? Infinity : b.startMs ?? Infinity) || priorityRank[a.priority] - priorityRank[b.priority] || a.title.localeCompare(b.title) || a.occurrenceKey.localeCompare(b.occurrenceKey);
  return { upcoming: visible.filter(o => o.date >= today && isTask(o) && o.status !== 'completed' && !isOverdue(o, now)).sort(taskSort), overdue: [...new Map([...historic, ...recentRecurring, ...visible.filter(o => isOverdue(o, now))].map(o => [o.occurrenceKey, o])).values()].sort(taskSort), nextEvent: visible.find(o => !isTask(o) && (o.startMs ?? 0) >= now) ?? null };
}
export function monthCells(month: string, weekStart: 1 | 7): string[] {
  const first = day(`${month.slice(0, 7)}-01`); const start = first.minus({ days: (first.weekday - weekStart + 7) % 7 });
  const nextMonth = first.plus({ months: 1 }); const length = Math.ceil(nextMonth.diff(start, 'days').days / 7) * 7;
  return Array.from({ length }, (_, i) => start.plus({ days: i }).toISODate()!);
}
export function formatTime(ms: number, zone: string, format: '12' | '24' = '12'): string { return DateTime.fromMillis(ms, { zone }).toFormat(format === '12' ? 'h:mm a' : 'HH:mm'); }
export function timingLabel(item: Occurrence, zone: string, format: '12' | '24' = '12'): string {
  if (item.timing.mode === 'allDay') return 'All day';
  if (item.timing.mode === 'unscheduled') return 'No due date';
  if (item.timing.mode === 'deadline' && !item.timing.time) return 'Due today';
  const start = formatTime(item.startMs!, zone, format);
  return item.timing.mode === 'timed' ? `${start} – ${formatTime(item.endMs!, zone, format)}` : `Due ${start}`;
}
export function reminderCandidates(records: DomainRecord[], now: number, zone: string): Array<{ id: string; item: Occurrence; dueMs: number; ruleId: string }> {
  const today = DateTime.fromMillis(now, { zone }).toISODate()!;
  const items = expand(records, addDays(today, -2), addDays(today, 32), zone);
  return items.filter(o => o.status !== 'completed' && o.startMs !== null).flatMap(item => item.reminders.map(rule => ({ id: `${item.occurrenceKey}:${rule.id}`, item, ruleId: rule.id, dueMs: item.startMs! - rule.minutesBefore * 60000 })));
}
