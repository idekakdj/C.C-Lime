import { z } from 'zod';
import { DateTime, IANAZone } from 'luxon';

export const uid = z.string().uuid();
export const localDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = DateTime.fromISO(value); return date.isValid && date.year >= 1900 && date.year <= 2100;
}, 'Enter a real date between 1900 and 2100.');
export const localTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const zone = z.string().refine(value => IANAZone.isValidZone(value) || value === 'UTC', 'Choose a valid time zone.');
const title = z.string().trim().min(1, 'A title is required.').max(200);
const instant = z.string().refine(value => DateTime.fromISO(value, { setZone: true }).isValid && /(?:Z|[+-]\d{2}:\d{2})$/.test(value), 'Use a complete timestamp with a time-zone offset.');
export const timingSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('timed'), start: instant, end: instant, zone }).strict().refine(t => DateTime.fromISO(t.end).toMillis() > DateTime.fromISO(t.start).toMillis(), 'End time must be after start time.').refine(t => [t.start,t.end].every(value=>{const date=DateTime.fromISO(value).setZone(t.zone);return date.isValid&&date.year>=1900&&date.year<=2100;}), 'Event dates must be between 1900 and 2100 in their time zone.'),
  z.object({ mode: z.literal('allDay'), startDate: localDate, endDate: localDate, zone, anchorTime: localTime.default('09:00') }).strict().refine(t => t.endDate > t.startDate, 'The exclusive end date must be after the first date.'),
  z.object({ mode: z.literal('deadline'), date: localDate, time: localTime.nullable(), zone, anchorTime: localTime.default('09:00') }).strict(),
  z.object({ mode: z.literal('unscheduled'), zone }).strict(),
]);
export const recurrenceSchema = z.object({
  frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']), interval: z.number().int().min(1).max(52).default(1),
  weekdays: z.array(z.number().int().min(1).max(7)).max(7).default([]), until: localDate.nullable().default(null),
  count: z.number().int().min(1).max(999).nullable().default(null), monthlyMode: z.enum(['date', 'ordinal']).default('date'),
  ordinal: z.number().int().refine(n => [-1, 1, 2, 3, 4, 5].includes(n)).default(1),
  excludedDates: z.array(localDate).max(2000).default([]), extraDates: z.array(localDate).max(2000).default([]),
}).strict().refine(r => !(r.until && r.count), 'Choose an end date or an occurrence count, not both.');
export const reminderSchema = z.object({ id: uid, minutesBefore: z.number().int().min(0).max(43200) }).strict();
export const statusSchema = z.enum(['open', 'in_progress', 'completed']);
const itemFields = {
  title, itemType: z.enum(['class', 'event', 'assignment', 'exam', 'study', 'task']), timing: timingSchema,
  courseId: uid.nullable().default(null), notes: z.string().max(10000).default(''), location: z.string().max(300).default(''),
  status: statusSchema.default('open'), priority: z.enum(['high', 'normal', 'low']).default('normal'),
  estimatedMinutes: z.number().int().min(5).max(6000).nullable().default(null), assignmentId: uid.nullable().default(null),
  recurrence: recurrenceSchema.nullable().default(null), reminders: z.array(reminderSchema).max(5).default([]),
  completedAt: instant.nullable().default(null), sourceUid: z.string().max(1000).nullable().default(null),
};
export const itemSchema = z.object({ id: uid, kind: z.literal('item'), ...itemFields }).strict().superRefine((item, ctx) => {
  if (['assignment', 'task'].includes(item.itemType) && item.recurrence) ctx.addIssue({ code: 'custom', message: 'Assignments and personal tasks do not repeat. Use recurring study sessions.', path: ['recurrence'] });
  if (['class', 'study'].includes(item.itemType) && item.timing.mode !== 'timed') ctx.addIssue({ code: 'custom', message: 'Classes and study sessions need a start and end time.', path: ['timing'] });
  if (item.recurrence && !['timed', 'allDay'].includes(item.timing.mode)) ctx.addIssue({ code: 'custom', message: 'Repeating items need a timed or all-day schedule.', path: ['recurrence'] });
  if (new Set(item.reminders.map(r => r.id)).size !== item.reminders.length) ctx.addIssue({ code: 'custom', message: 'Reminder identities must be unique.', path: ['reminders'] });
});
export const courseSchema = z.object({ id: uid, kind: z.literal('course'), name: title, code: z.string().max(30).default(''), semesterId: uid.nullable().default(null), instructor: z.string().max(200).default(''), location: z.string().max(300).default(''), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#A78BFA'), archived: z.boolean().default(false) }).strict();
export const semesterSchema = z.object({ id: uid, kind: z.literal('semester'), name: title, startDate: localDate, endDate: localDate, zone, breaks: z.array(z.object({ startDate: localDate, endDate: localDate }).strict().refine(b => b.endDate >= b.startDate)).max(100).default([]), archived: z.boolean().default(false) }).strict().refine(s => s.endDate >= s.startDate, 'Semester end must be on or after its start.');
export const exceptionSchema = z.object({ id: uid, kind: z.literal('exception'), seriesId: uid, originalDate: localDate, cancelled: z.boolean().default(false), override: z.object({ title: title.optional(), timing: timingSchema.optional(), notes: z.string().max(10000).optional(), location: z.string().max(300).optional(), reminders: z.array(reminderSchema).max(5).optional() }).strict().default({}) }).strict();
export const occurrenceStateSchema = z.object({ id: uid, kind: z.literal('occurrenceState'), seriesId: uid, originalDate: localDate, status: statusSchema, completedAt: instant.nullable().default(null) }).strict();
export const preferencesSchema = z.object({ id: uid, kind: z.literal('preferences'), weekStart: z.union([z.literal(1), z.literal(7)]).default(1), zone, timeFormat: z.enum(['12', '24']).default('12'), defaultEventReminder: z.number().int().min(0).max(43200).default(15), defaultTaskReminder: z.number().int().min(0).max(43200).default(1440) }).strict();
export const recordSchema = z.discriminatedUnion('kind', [itemSchema, courseSchema, semesterSchema, exceptionSchema, occurrenceStateSchema, preferencesSchema]);
export type Timing = z.infer<typeof timingSchema>;
export type Recurrence = z.infer<typeof recurrenceSchema>;
export type CalendarItem = z.infer<typeof itemSchema>;
export type Course = z.infer<typeof courseSchema>;
export type Semester = z.infer<typeof semesterSchema>;
export type OccurrenceException = z.infer<typeof exceptionSchema>;
export type OccurrenceState = z.infer<typeof occurrenceStateSchema>;
export type Preferences = z.infer<typeof preferencesSchema>;
export type DomainRecord = z.infer<typeof recordSchema>;
export type ItemType = CalendarItem['itemType'];
export interface Occurrence extends CalendarItem { occurrenceKey: string; originalDate: string; seriesId: string | null; startMs: number | null; endMs: number | null; date: string; endDate: string; }
export interface Session { uid: string; email: string; displayName: string; verified: boolean; providers: string[]; offline?: boolean; }
export interface DeviceSettings { notifications: boolean; startAtLogin: boolean; closeToTray: boolean; quietStart: string | null; quietEnd: string | null; privacy: boolean; followZone: boolean; onboardingDone: boolean; view: 'month' | 'week' | 'agenda'; month: string | null; hideCompleted: boolean; }
export const defaultDeviceSettings: DeviceSettings = { notifications: false, startAtLogin: false, closeToTray: true, quietStart: null, quietEnd: null, privacy: false, followZone: false, onboardingDone: false, view: 'month', month: null, hideCompleted: false };
export interface SyncStatus { state: 'local' | 'syncing' | 'synced' | 'offline' | 'verification' | 'error' | 'conflict'; pending: number; lastSynced: string | null; message: string; }
export interface Conflict { id: string; recordId: string; base: DomainRecord | null; local: DomainRecord | null; remote: DomainRecord | null; remoteVersion: string | null; }
export interface ReminderEntry { id: string; itemId: string; occurrenceKey: string; ruleId: string; title: string; dueMs: number; anchorMs: number; endMs: number; task: boolean; state: string; snoozeMs: number | null; createdMs: number; }
export interface NotificationTest { state:'submitted'|'failed'; checkedAt:string; message:string; }
export interface Snapshot { records: DomainRecord[]; session: Session | null; device: DeviceSettings; sync: SyncStatus; conflicts: Conflict[]; reminders: ReminderEntry[]; configured: boolean; googleConfigured: boolean; version: string; localMode: boolean; deleting?:boolean; recordsRevision?:string; displayZone?:string; notificationTest?:NotificationTest|null; }
export interface CloudConfiguration { apiKey: string; projectId: string; googleClientId?: string; googleClientSecret?: string; }
export interface ImportCandidate { record: DomainRecord; sourceHash: string; action: 'new' | 'identical' | 'changed'; existingId?: string; }
export interface ImportPreview { token: string; candidates: ImportCandidate[]; warnings: string[]; invalid: number; filename: string; }
export interface LimeApi {
  call<T = unknown>(command: string, payload?: unknown): Promise<T>;
  onChange(callback: () => void): () => void;
  onNavigate(callback: (target: { itemId?: string; occurrenceKey?:string; action?: string }) => void): () => void;
}
declare global { interface Window { lime: LimeApi; } }
export function parseRecord(input: unknown): DomainRecord { return recordSchema.parse(input); }
export function isTask(item: Pick<CalendarItem, 'itemType'>): boolean { return ['assignment', 'task', 'study', 'exam'].includes(item.itemType); }
export function makeItem(id: string, date: string, tz: string, itemType: ItemType = 'event'): CalendarItem {
  const start = DateTime.fromISO(`${date}T09:00`, { zone: tz });
  return itemSchema.parse({ id, kind: 'item', title: 'Untitled', itemType, timing: { mode: 'timed', start: start.toUTC().toISO(), end: start.plus({ hours: 1 }).toUTC().toISO(), zone: tz } });
}
