import { DateTime } from 'luxon';
import { reminderCandidates } from '../domain/calendar';
import { isTask, type DeviceSettings, type ReminderEntry } from '../shared/model';
import { LocalStore } from './store';

export interface ReminderNotice { title: string; body: string; itemId?: string; occurrenceKey?:string; inbox?: boolean; onFailure: () => void; }
export function inQuietHours(now: number, zone: string, start: string | null, end: string | null): boolean {
  if (!start || !end || start === end) return false;
  const time = DateTime.fromMillis(now, { zone }).toFormat('HH:mm');
  return start < end ? time >= start && time < end : time >= start || time < end;
}
export class ReminderScheduler {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;
  constructor(private store: LocalStore, private settings: () => DeviceSettings, private zone: () => string, private emit: (notice: ReminderNotice) => void, private changed: () => void = () => {}, private clock = () => Date.now()) {}
  start(): void { this.stopped = false; this.reconcile(); }
  stop(): void { this.stopped = true; if (this.timer) clearTimeout(this.timer); this.timer = null; }
  reconcile(schedule = true): void {
    if (this.stopped) return; if (this.timer) clearTimeout(this.timer); this.timer = null;
    const now = this.clock(), device = this.settings(); const records = this.store.list();
    const candidates = reminderCandidates(records, now, this.zone());
    const active = new Set(candidates.map(c => c.id)); const previous = new Map(this.store.reminders().map(r => [r.id,r]));
    const relevant = (entry: ReminderEntry) => entry.task || entry.endMs > now;
    for (const candidate of candidates) {
      const prior = previous.get(candidate.id); const marker = this.store.delivered(candidate.id);
      const movedFuture = !!prior && (prior.dueMs !== candidate.dueMs || prior.state === 'canceled') && candidate.dueMs > now && marker !== candidate.dueMs;
      if (prior && !movedFuture) {
        if (['pending','snoozed','suppressed'].includes(prior.state)) this.store.putReminder({ ...prior, title: candidate.item.title, anchorMs: candidate.item.startMs!, endMs: candidate.item.endMs!, dueMs: candidate.dueMs });
        continue;
      }
      if (!prior && marker !== null && (marker === candidate.dueMs || candidate.dueMs <= now)) continue;
      const entry: ReminderEntry = { id: candidate.id, itemId: candidate.item.id, occurrenceKey: candidate.item.occurrenceKey, ruleId: candidate.ruleId, title: candidate.item.title, dueMs: candidate.dueMs, anchorMs: candidate.item.startMs!, endMs: candidate.item.endMs!, task: isTask(candidate.item), state: candidate.dueMs < now - 86400000 ? 'missed' : 'pending', snoozeMs: null, createdMs: prior?.createdMs ?? now };
      this.store.putReminder(entry);
    }
    for (const prior of previous.values()) if (!active.has(prior.id) && ['pending','snoozed','suppressed'].includes(prior.state)) this.store.putReminder({ ...prior, state: 'canceled', snoozeMs: null });
    const quiet = inQuietHours(now, this.zone(), device.quietStart, device.quietEnd);
    const due = this.store.reminders().filter(r => ['pending','snoozed'].includes(r.state) && (r.snoozeMs ?? r.dueMs) <= now);
    const eligible: ReminderEntry[] = [];
    for (const entry of due) {
      if (!relevant(entry) || (entry.snoozeMs ?? entry.dueMs) < now - 86400000) { this.store.putReminder({ ...entry, state: 'missed' }); continue; }
      if (quiet || !device.notifications) { this.store.putReminder({ ...entry, state: 'suppressed' }); continue; }
      eligible.push(entry);
    }
    const suppressed = this.store.reminders().filter(r => r.state === 'suppressed' && active.has(r.id));
    if (!quiet && device.notifications) {
      const stillRelevant = suppressed.filter(relevant);
      for (const old of suppressed.filter(r => !relevant(r))) this.store.putReminder({ ...old, state: 'missed' });
      if (stillRelevant.length) this.deliver(stillRelevant, true, device.privacy);
      if (eligible.length > 3) this.deliver(eligible, true, device.privacy);
      else for (const entry of eligible) this.deliver([entry], false, device.privacy);
    }
    this.store.pruneReminders(now); this.changed();
    if (schedule && !this.stopped) {
      const future = this.store.reminders().filter(r => ['pending','snoozed'].includes(r.state)).map(r => r.snoozeMs ?? r.dueMs).filter(ms => ms > now);
      const delay = Math.max(100, Math.min(60000, ...future.map(ms => ms-now)));
      this.timer = setTimeout(() => this.reconcile(), delay);
    }
  }
  private deliver(entries: ReminderEntry[], summary: boolean, privacy: boolean): void {
    for (const entry of entries) { this.store.putReminder({ ...entry, state: 'dispatching' }); this.store.markDelivered(entry.id, entry.dueMs); }
    let failed = false;
    const onFailure = () => { failed = true; if (this.stopped) return; for (const entry of entries) this.store.putReminder({ ...entry, state: 'failed' }); this.changed(); };
    try {
      this.emit({ title: privacy ? 'C.C. Lime reminder' : summary ? `${entries.length} reminders to catch up on` : entries[0].title, body: privacy ? 'Open C.C. Lime to see the details.' : summary ? 'Open your reminder inbox to see what’s coming up.' : 'Your scheduled reminder is ready. Open C.C. Lime for details.', itemId: summary ? undefined : entries[0].itemId, occurrenceKey:summary?undefined:entries[0].occurrenceKey, inbox: summary, onFailure });
      if (!failed) for (const entry of entries) this.store.putReminder({ ...entry, state: 'emitted', snoozeMs: null });
    } catch { onFailure(); }
  }
  snooze(id: string, minutes: number): void {
    if (![5,10,15,30,60].includes(minutes)) throw new Error('Choose a snooze of 5, 10, 15, 30 or 60 minutes.');
    const entry = this.store.reminders().find(r => r.id === id); if (!entry) throw new Error('This reminder is no longer available.');
    const active = reminderCandidates(this.store.list(), this.clock(), this.zone()).some(c => c.id === id);
    if (!active) throw new Error('This item is completed, deleted or no longer in the reminder schedule.');
    this.store.putReminder({ ...entry, state: 'snoozed', snoozeMs: this.clock() + minutes*60000 }); this.reconcile();
  }
  dismiss(id: string): void { const entry = this.store.reminders().find(r => r.id === id); if (entry) { this.store.putReminder({ ...entry, state: 'dismissed', snoozeMs: null }); this.store.markDelivered(entry.id,entry.dueMs); this.changed(); } }
}
