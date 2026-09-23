import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { DateTime } from 'luxon';
import { addDays, atDate, expand, isOverdue, localInstant, monthCells, recurringDates, reminderCandidates, upcoming } from '../../src/domain/calendar';
import { exceptionSchema, itemSchema, occurrenceStateSchema, recordSchema } from '../../src/shared/model';
import { item, millis, recurrence } from '../fixtures';

describe('calendar dates and time zones', () => {
  it('produces exact four-, five-, and six-week months', () => {
    expect(monthCells('2021-02', 1)).toHaveLength(28);
    expect(monthCells('2026-09', 1)).toHaveLength(35);
    expect(monthCells('2026-08', 1)).toHaveLength(42);
    expect(monthCells('2026-09', 7)[0]).toBe('2026-08-30');
  });
  it('uses calendar arithmetic across leap days and years', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29'); expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
  it('rejects nonexistent wall time and resolves ambiguous wall time explicitly', () => {
    expect(() => localInstant('2026-03-08', '02:30', 'America/Toronto')).toThrow('does not exist');
    expect(localInstant('2026-11-01', '01:30', 'America/Toronto', true).toMillis() - localInstant('2026-11-01', '01:30', 'America/Toronto').toMillis()).toBe(3600000);
  });
  it('preserves 09:00 class time across both DST transitions', () => {
    for (const [first, second] of [['2026-03-01', '2026-03-08'], ['2026-10-25', '2026-11-01']]) {
      const start = localInstant(first, '09:00', 'America/Toronto');
      const lecture = item({ timing: { mode: 'timed', start: start.toUTC().toISO()!, end: start.plus({ hours: 1 }).toUTC().toISO()!, zone: 'America/Toronto' }, recurrence: recurrence({ weekdays: [7] }) });
      const instances = expand([lecture], first, addDays(second, 1), 'America/Toronto');
      expect(instances.map(o => DateTime.fromMillis(o.startMs!, { zone: 'America/Toronto' }).hour)).toEqual([9, 9]);
      expect(Math.abs((instances[1].startMs! - instances[0].startMs!) - 7 * 86400000)).toBe(3600000);
    }
  });
  it('keeps all-day values on their dates when displaying a different zone', () => {
    const allDay = item({ timing: { mode: 'allDay', startDate: '2026-09-18', endDate: '2026-09-19', zone: 'Pacific/Auckland', anchorTime: '09:00' } });
    expect(expand([allDay], '2026-09-18', '2026-09-20', 'America/Vancouver')[0].date).toBe('2026-09-18');
    expect(expand([allDay], '2026-09-19', '2026-09-20', 'UTC')).toHaveLength(0);
  });
  it('includes midnight-spanning events and preserves elapsed duration when moved', () => {
    const crossing = item({ timing: { mode: 'timed', start: '2026-09-19T03:30:00Z', end: '2026-09-19T04:30:00Z', zone: 'America/Toronto' } });
    expect(expand([crossing], '2026-09-19', '2026-09-20', 'America/Toronto')).toHaveLength(1);
    const moved = atDate(crossing.timing, '2026-10-04');
    if (moved.mode !== 'timed') throw Error('wrong mode');
    expect(DateTime.fromISO(moved.end).toMillis() - DateTime.fromISO(moved.start).toMillis()).toBe(3600000);
  });
});

describe('recurrence and occurrence identity', () => {
  it('skips nonexistent monthly dates rather than clamping them', () => {
    const meeting = item({ timing: { mode: 'allDay', startDate: '2026-01-31', endDate: '2026-02-01', zone: 'UTC', anchorTime: '09:00' }, recurrence: recurrence({ frequency: 'MONTHLY', weekdays: [] }) });
    expect(recurringDates(meeting, '2026-01-01', '2026-06-01')).toEqual(['2026-01-31', '2026-03-31', '2026-05-31']);
  });
  it('handles leap-year annual recurrence', () => {
    const event = item({ timing: { mode: 'allDay', startDate: '2028-02-29', endDate: '2028-03-01', zone: 'UTC', anchorTime: '09:00' }, recurrence: recurrence({ frequency: 'YEARLY', weekdays: [] }) });
    expect(recurringDates(event, '2028-01-01', '2033-01-01')).toEqual(['2028-02-29', '2032-02-29']);
  });
  it('honors count, exclusions and additional dates', () => {
    const lecture = item({ recurrence: recurrence({ count: 3, excludedDates: ['2026-09-25'], extraDates: ['2026-09-23'] }) });
    expect(recurringDates(lecture, '2026-09-01', '2027-01-01')).toEqual(['2026-09-18', '2026-09-23', '2026-10-02']);
  });
  it('skips a spring-gap occurrence without consuming COUNT', () => {
    const event = item({ timing: { mode: 'timed', start: '2026-03-01T07:30:00Z', end: '2026-03-01T08:30:00Z', zone: 'America/Toronto' }, recurrence: recurrence({ weekdays: [7], count: 2 }) });
    expect(recurringDates(event, '2026-03-01', '2026-04-01')).toEqual(['2026-03-01', '2026-03-15']);
  });
  it('finds a moved exception outside the original range and retains completion identity', () => {
    const session = item({ itemType: 'study', recurrence: recurrence({ count: 1 }) });
    const exception = exceptionSchema.parse({ id: randomUUID(), kind: 'exception', seriesId: session.id, originalDate: '2026-09-18', override: { timing: atDate(session.timing, '2026-11-12') } });
    const state = occurrenceStateSchema.parse({ id: randomUUID(), kind: 'occurrenceState', seriesId: session.id, originalDate: '2026-09-18', status: 'completed', completedAt: '2026-11-12T15:00:00Z' });
    expect(expand([session, exception], '2026-09-18', '2026-09-19', 'America/Toronto')).toHaveLength(0);
    const moved = expand([session, exception, state], '2026-11-01', '2026-12-01', 'America/Toronto');
    expect(moved).toHaveLength(1); expect(moved[0].originalDate).toBe('2026-09-18'); expect(moved[0].status).toBe('completed');
  });
  it('cancels one occurrence without deleting its neighbors', () => {
    const lecture = item({ recurrence: recurrence({ count: 3 }) });
    const exception = exceptionSchema.parse({ id: randomUUID(), kind: 'exception', seriesId: lecture.id, originalDate: '2026-09-25', cancelled: true });
    expect(expand([lecture, exception], '2026-09-01', '2026-11-01', 'UTC').map(o => o.originalDate)).toEqual(['2026-09-18', '2026-10-02']);
  });
});

describe('student sidebar and reminders', () => {
  it('uses today plus six dates across a year boundary', () => {
    const tasks = ['2026-12-28', '2026-12-29', '2027-01-04', '2027-01-05'].map(date => item({ itemType: 'assignment', timing: { mode: 'deadline', date, time: null, zone: 'America/Toronto', anchorTime: '09:00' } }));
    const list = upcoming(tasks, millis('2026-12-29T12:00'), 'America/Toronto');
    expect(list.upcoming.map(t => t.date)).toEqual(['2026-12-29', '2027-01-04']); expect(list.overdue.map(t => t.date)).toEqual(['2026-12-28']);
  });
  it('makes date-only tasks overdue exactly at the next local midnight', () => {
    const task = item({ itemType: 'task', timing: { mode: 'deadline', date: '2026-03-08', time: null, zone: 'America/Toronto', anchorTime: '09:00' } });
    const occurrence = expand([task], '2026-03-08', '2026-03-10', 'America/Toronto')[0];
    expect(isOverdue(occurrence, millis('2026-03-08T23:59'))).toBe(false); expect(isOverdue(occurrence, millis('2026-03-09T00:00'))).toBe(true);
  });
  it('excludes completed and unscheduled tasks and ordinary classes', () => {
    const records = [item({ itemType: 'class' }), item({ itemType: 'task', timing: { mode: 'unscheduled', zone: 'UTC' } }), item({ itemType: 'assignment', status: 'completed' })];
    expect(upcoming(records, millis('2026-09-18T08:00'), 'America/Toronto').upcoming).toHaveLength(0);
  });
  it('calculates reminder anchors and does not remind completed items', () => {
    const task = item({ itemType: 'assignment', timing: { mode: 'deadline', date: '2026-09-18', time: null, zone: 'America/Toronto', anchorTime: '09:00' }, reminders: [{ id: randomUUID(), minutesBefore: 1440 }] });
    expect(reminderCandidates([task], millis('2026-09-17T08:00'), 'America/Toronto')[0].dueMs).toBe(millis('2026-09-17T09:00'));
    expect(reminderCandidates([{ ...task, status: 'completed' }], millis('2026-09-17T08:00'), 'America/Toronto')).toHaveLength(0);
  });
});

describe('schema boundaries', () => {
  it.each(['', ' ', 'x'.repeat(201)])('rejects invalid titles', title => { expect(() => item({ title })).toThrow(); });
  it('rejects invalid end dates, unknown fields and repeating assignments', () => {
    expect(() => item({ timing: { mode: 'timed', start: '2026-01-01T10:00:00Z', end: '2026-01-01T09:00:00Z', zone: 'UTC' } })).toThrow();
    expect(() => recordSchema.parse({ ...item(), admin: true })).toThrow();
    expect(() => item({ itemType: 'assignment', recurrence: recurrence() })).toThrow();
    expect(() => itemSchema.parse({ ...item(), notes: 'x'.repeat(10001) })).toThrow();
  });
});
