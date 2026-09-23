import { CloudError, VersionConflict, type CloudAdapter } from './cloud';
import { LocalStore } from './store';
import type { Session, SyncStatus } from '../shared/model';

export class SyncEngine {
  private stopped = false;
  private running: Promise<void> | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private failures = 0;
  private visible = true;
  status: SyncStatus;
  constructor(private store: LocalStore, private cloud: CloudAdapter, private session: () => Session | null, private changed: () => void = () => {}) {
    this.status = { state: 'local', pending: store.queue().length, lastSynced: store.metadata('lastSynced', null), message: 'Changes are saved on this computer.' };
  }
  private update(state: SyncStatus['state'], message: string): void { if (this.stopped) return; this.status = { state, message, pending: this.store.queue().length, lastSynced: this.store.metadata('lastSynced', null) }; this.changed(); }
  start(): void { this.stopped = false; this.schedule(0); }
  setVisible(visible: boolean): void { this.visible = visible; if (visible) this.schedule(100); }
  schedule(delay = 700): void { if (this.stopped) return; if (this.timer) clearTimeout(this.timer); this.timer = setTimeout(() => { this.timer = null; void this.sync(); }, delay); }
  async stop(): Promise<void> { this.stopped = true; if (this.timer) clearTimeout(this.timer); this.timer = null; await this.running; }
  async sync(): Promise<void> {
    if (this.stopped) return; if (this.running) return this.running;
    this.running = this.run().finally(() => { this.running = null; if (!this.stopped && !this.timer) this.schedule(this.failures ? Math.min(300000, 5000 * 2 ** Math.min(this.failures, 6)) + Math.random()*1000 : this.visible ? 60000 : 300000); });
    return this.running;
  }
  async retry(): Promise<void> { this.store.retryFailed(); this.failures = 0; await this.sync(); }
  private async run(): Promise<void> {
    const session = this.session();
    if (!session) { this.update('local', 'Sign in to sync. Changes are saved on this computer.'); return; }
    if (!session.verified) { this.update('verification', 'Verify your email to sync. Changes are saved on this computer.'); return; }
    this.update('syncing', 'Syncing your calendar…');
    try {
      let count = 0;
      while (!this.stopped && count++ < 1000) {
        const queue = this.store.queue();
        const mutation = queue.find(m => m.state === 'pending' && !queue.some(earlier => earlier.recordId === m.recordId && earlier.order < m.order));
        if (!mutation) break;
        this.store.markSending(mutation.id);
        try { const remote = await this.cloud.commit(mutation); if (this.stopped) return; this.store.acknowledge(mutation, remote); }
        catch (error) {
          if (this.stopped) return;
          if (error instanceof VersionConflict) { this.store.conflict(mutation, error.current); continue; }
          const permanent = error instanceof CloudError && ['INVALID_ARGUMENT','SCHEMA_MISMATCH','PERMISSION_DENIED'].includes(error.code);
          this.store.resetMutation(mutation.id, permanent); throw error;
        }
      }
      if (this.stopped) return;
      const start = this.store.metadata('cursor', 0); const high = await this.cloud.head();
      if (this.stopped) return;
      if (high < start) throw new Error('The cloud history changed unexpectedly. Contact the project owner before resetting sync.');
      let cursor = start; let afterId: string | undefined;
      if (high > start) {
        for (let pages = 0; pages < 10000; pages++) {
          const page = await this.cloud.changes(cursor, high, afterId); if (this.stopped) return;
          if (!page.length) break;
          if (page.some(r => r.sequence <= start || r.sequence > high)) throw new Error('Invalid cloud page boundary.');
          // Resolve parent links before exposing a received page; a missing/tombstoned parent remains explicitly unavailable.
          const incoming = new Set(page.map(r => r.id)); const missing = new Set<string>();
          for (const remote of page) {
            const r = remote.value; if (!r) continue;
            const refs = r.kind === 'item' ? [r.courseId, r.assignmentId] : r.kind === 'course' ? [r.semesterId] : r.kind === 'exception' || r.kind === 'occurrenceState' ? [r.seriesId] : [];
            for (const id of refs) if (id && !incoming.has(id) && !this.store.get(id)) missing.add(id);
          }
          for (const id of missing) { const record = await this.cloud.get(id); if (this.stopped) return; if (record) this.store.applyRemote([record]); }
          this.store.applyRemote(page); const last = page.at(-1)!;
          if (last.sequence === cursor && last.id === afterId) throw new Error('Cloud pagination did not advance.');
          cursor = last.sequence; afterId = last.id;
          if (page.length < 100) break;
          if (pages === 9999) throw new Error('Calendar is too large to synchronize in one pass.');
        }
        if (this.stopped) return; this.store.applyRemote([], high);
      }
      this.store.setMetadata('lastSynced', new Date().toISOString()); this.failures = 0;
      if (this.store.conflicts().length) this.update('conflict', 'Changes need your review. Your versions are preserved.');
      else if (this.store.queue().some(m => m.state === 'failed')) this.update('error', 'Some changes could not sync. They are saved on this computer.');
      else if (this.store.queue().length) { this.update('local', 'Changes are saved on this computer and waiting to sync.'); this.schedule(); }
      else this.update('synced', 'Your calendar is up to date.');
    } catch (error) {
      if (this.stopped) return; this.failures++;
      const permanent = error instanceof CloudError && [400,401,403].includes(error.status);
      this.update(permanent ? 'error' : 'offline', permanent ? 'Cloud access needs attention. Your changes are saved on this computer.' : 'Could not connect. Your changes are saved on this computer and will retry.');
    }
  }
}
