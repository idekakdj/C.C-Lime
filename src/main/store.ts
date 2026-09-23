import Database from 'better-sqlite3';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { parseRecord, type Conflict, type DomainRecord, type ReminderEntry } from '../shared/model';
import { recurringDates } from '../domain/calendar';

export interface Mutation { id: string; order: number; recordId: string; baseVersion: string | null; base: DomainRecord | null; value: DomainRecord | null; state: string; attempts: number; }
export interface RemoteRecord { id: string; value: DomainRecord | null; version: string; sequence: number; }
const parse = <T>(value: string | null): T | null => value === null ? null : JSON.parse(value);
export const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function sqlString(value: string): string { return `'${value.replaceAll("'", "''")}'`; }

export class LocalStore {
  readonly db: Database.Database;
  readonly directory: string;
  readonly filename: string;
  private closed = false;
  constructor(root: string, readonly accountId: string) {
    this.directory = path.join(root, 'accounts', createHash('sha256').update(accountId).digest('hex').slice(0, 32));
    fs.mkdirSync(this.directory, { recursive: true });
    this.filename = path.join(this.directory, 'calendar.sqlite');
    this.db = new Database(this.filename);
    try {
      this.db.pragma('journal_mode = WAL'); this.db.pragma('synchronous = FULL'); this.db.pragma('foreign_keys = ON');
      const integrity = this.db.pragma('quick_check', { simple: true }); if (integrity !== 'ok') throw new Error('The calendar database needs recovery. The existing file has been preserved.');
      const version = this.db.pragma('user_version', { simple: true }) as number;
      if (version > 1) throw new Error('This calendar was saved by a newer C.C. Lime version. Update the app to open it.');
      if (version < 1) {
        if (fs.statSync(this.filename).size > 0 && this.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().length) this.snapshot('pre-migration');
        this.db.transaction(() => {
          this.db.exec(`
            CREATE TABLE IF NOT EXISTS records(id TEXT PRIMARY KEY, kind TEXT NOT NULL, payload TEXT, deleted INTEGER NOT NULL DEFAULT 0, local_revision INTEGER NOT NULL DEFAULT 1);
            CREATE INDEX IF NOT EXISTS records_kind ON records(kind, deleted);
            CREATE UNIQUE INDEX IF NOT EXISTS unique_exception ON records(kind,json_extract(payload,'$.seriesId'),json_extract(payload,'$.originalDate')) WHERE kind IN ('exception','occurrenceState') AND deleted=0;
            CREATE UNIQUE INDEX IF NOT EXISTS unique_preferences ON records(kind) WHERE kind='preferences' AND deleted=0;
            CREATE TABLE IF NOT EXISTS shadows(id TEXT PRIMARY KEY, payload TEXT, version TEXT NOT NULL, sequence INTEGER NOT NULL);
            CREATE TABLE IF NOT EXISTS outbox(position INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT UNIQUE NOT NULL, record_id TEXT NOT NULL, base_version TEXT, base_payload TEXT, payload TEXT, state TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0);
            CREATE INDEX IF NOT EXISTS outbox_state ON outbox(state, position);
            CREATE TABLE IF NOT EXISTS conflicts(id TEXT PRIMARY KEY, record_id TEXT UNIQUE NOT NULL, base TEXT, local TEXT, remote TEXT, remote_version TEXT);
            CREATE TABLE IF NOT EXISTS metadata(key TEXT PRIMARY KEY, value TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS reminders(id TEXT PRIMARY KEY, payload TEXT NOT NULL, due_ms INTEGER NOT NULL, state TEXT NOT NULL);
            CREATE INDEX IF NOT EXISTS reminders_due ON reminders(state,due_ms);
            CREATE TABLE IF NOT EXISTS delivery_markers(id TEXT PRIMARY KEY, due_ms INTEGER NOT NULL);
            CREATE TABLE IF NOT EXISTS undo(id TEXT PRIMARY KEY, expires_ms INTEGER NOT NULL, before_payload TEXT NOT NULL, after_hash TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS import_batches(id TEXT PRIMARY KEY, created_at TEXT NOT NULL, before_payload TEXT NOT NULL, after_payload TEXT NOT NULL);
            PRAGMA user_version = 1;
          `);
        })();
      }
      this.db.prepare("UPDATE outbox SET state='pending' WHERE state='sending'").run();
      for (const entry of this.reminders()) if (entry.state === 'dispatching') this.putReminder({ ...entry, state: 'uncertain' });
    } catch (error) { this.db.close(); throw error; }
  }
  list(): DomainRecord[] { return (this.db.prepare('SELECT payload FROM records WHERE deleted=0 ORDER BY id').all() as Array<{ payload: string }>).map(row => parseRecord(JSON.parse(row.payload))); }
  get(id: string): DomainRecord | null { const row = this.db.prepare('SELECT payload FROM records WHERE id=? AND deleted=0').get(id) as { payload: string } | undefined; return row ? parseRecord(JSON.parse(row.payload)) : null; }
  metadata<T>(key: string, fallback: T): T { const row = this.db.prepare('SELECT value FROM metadata WHERE key=?').get(key) as { value: string } | undefined; return row ? JSON.parse(row.value) : fallback; }
  setMetadata(key: string, value: unknown): void { this.db.prepare('INSERT OR REPLACE INTO metadata VALUES (?,?)').run(key, JSON.stringify(value)); }
  snapshot(label = 'manual'): string {
    const folder = path.join(this.directory, 'backups'); fs.mkdirSync(folder, { recursive: true });
    const destination = path.join(folder, `${label}-${new Date().toISOString().replaceAll(':', '-')}-${randomUUID().slice(0, 6)}.sqlite`);
    this.db.exec(`VACUUM INTO ${sqlString(destination)}`);
    const copies = fs.readdirSync(folder).filter(name => name.startsWith(`${label}-`) && name.endsWith('.sqlite')).sort();
    const retain = label === 'daily' ? 7 : label === 'pre-migration' ? 1 : 3;
    for (const name of copies.slice(0, -retain)) fs.unlinkSync(path.join(folder, name));
    return destination;
  }
  private beforeMutation(): void {
    const today = new Date().toISOString().slice(0, 10);
    if (this.metadata('dailyBackupDate', '') !== today) { this.snapshot('daily'); this.setMetadata('dailyBackupDate', today); }
  }
  private validateRelations(record: DomainRecord, prospective?: Map<string, DomainRecord>): void {
    const get = (id: string) => prospective?.get(id) ?? this.get(id);
    if (record.kind === 'item') {
      if (record.courseId && get(record.courseId)?.kind !== 'course') throw new Error('The selected course is unavailable.');
      if (record.assignmentId) { const assignment = get(record.assignmentId); if (assignment?.kind !== 'item' || assignment.itemType !== 'assignment') throw new Error('The linked assignment is unavailable.'); }
    }
    if (record.kind === 'course' && record.semesterId && get(record.semesterId)?.kind !== 'semester') throw new Error('The selected semester is unavailable.');
    if (record.kind === 'exception' || record.kind === 'occurrenceState') {
      const series = get(record.seriesId);
      if (series?.kind !== 'item' || !series.recurrence) throw new Error('The repeating series is unavailable.');
      const tomorrow = new Date(`${record.originalDate}T00:00:00Z`); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      if (!recurringDates(series, record.originalDate, tomorrow.toISOString().slice(0, 10)).includes(record.originalDate)) throw new Error('This date is not an occurrence of the series.');
    }
  }
  private write(recordId: string, value: DomainRecord | null, enqueue: boolean): void {
    const existing = this.db.prepare('SELECT kind FROM records WHERE id=?').get(recordId) as { kind: string } | undefined;
    if (value && existing && existing.kind !== value.kind) throw new Error('A record cannot change its type.');
    this.db.prepare('INSERT INTO records(id,kind,payload,deleted) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,deleted=excluded.deleted,local_revision=records.local_revision+1')
      .run(recordId, value?.kind ?? existing?.kind ?? 'item', value ? JSON.stringify(value) : null, value ? 0 : 1);
    if (enqueue) {
      const shadow = this.shadow(recordId);
      this.db.prepare('INSERT INTO outbox(id,record_id,base_version,base_payload,payload) VALUES (?,?,?,?,?)').run(randomUUID(), recordId, shadow?.version ?? null, shadow?.value ? JSON.stringify(shadow.value) : null, value ? JSON.stringify(value) : null);
    }
  }
  save(input: unknown): { record: DomainRecord; undoToken: string } {
    const value = parseRecord(input); this.validateRelations(value);
    if (this.conflicts().some(c => c.recordId === value.id)) throw new Error('Resolve this item’s sync conflict before editing it.');
    const before = this.get(value.id); this.beforeMutation(); const token = randomUUID();
    this.db.transaction(() => {
      this.write(value.id, value, true);
      this.db.prepare('INSERT INTO undo VALUES (?,?,?,?)').run(token, Date.now() + 10000, JSON.stringify([{ id: value.id, value: before }]), digest([{ id: value.id, value }]));
    })();
    return { record: value, undoToken: token };
  }
  remove(recordId: string): string {
    const existing = this.get(recordId); if (!existing) throw new Error('This item has already been removed.');
    const all = this.list();
    if (existing.kind === 'course' && all.some(r => r.kind === 'item' && r.courseId === recordId)) throw new Error('This course has scheduled items. Archive it instead.');
    if (existing.kind === 'semester' && all.some(r => r.kind === 'course' && r.semesterId === recordId)) throw new Error('This semester has courses. Archive it instead.');
    const children = all.filter(r => (r.kind === 'exception' || r.kind === 'occurrenceState') && r.seriesId === recordId);
    const linkedStudies = all.filter(r => r.kind === 'item' && r.assignmentId === recordId);
    const changes = [{ id: recordId, value: null as DomainRecord | null }, ...children.map(r => ({ id: r.id, value: null as DomainRecord | null })), ...linkedStudies.map(r => ({ id: r.id, value: { ...r, assignmentId: null } as DomainRecord }))];
    if (changes.some(c => this.conflicts().some(conflict => conflict.recordId === c.id))) throw new Error('Resolve pending sync conflicts before deleting this item.');
    const before = changes.map(c => ({ id: c.id, value: this.get(c.id) })); const token = randomUUID(); this.beforeMutation();
    this.db.transaction(() => { for (const c of changes) this.write(c.id, c.value, true); this.db.prepare('INSERT INTO undo VALUES (?,?,?,?)').run(token, Date.now() + 10000, JSON.stringify(before), digest(changes)); })();
    return token;
  }
  undo(token: string): void {
    const entry = this.db.prepare('SELECT * FROM undo WHERE id=?').get(token) as { expires_ms: number; before_payload: string; after_hash: string } | undefined;
    if (!entry || entry.expires_ms < Date.now()) throw new Error('The undo period has ended.');
    const before = JSON.parse(entry.before_payload) as Array<{ id: string; value: DomainRecord | null }>;
    if (digest(before.map(v => ({ id: v.id, value: this.get(v.id) }))) !== entry.after_hash) throw new Error('This item changed again. Review it before restoring an earlier version.');
    this.db.transaction(() => { for (const old of before) this.write(old.id, old.value, true); this.db.prepare('DELETE FROM undo WHERE id=?').run(token); })();
  }
  importRecords(inputs: unknown[], batchId = randomUUID()): string {
    const values = inputs.map(parseRecord); if (values.length > 5000) throw new Error('A batch may contain at most 5,000 records.');
    const prospective = new Map([...this.list(), ...values].map(r => [r.id, r])); for (const value of values) this.validateRelations(value, prospective);
    if (values.some(v => this.conflicts().some(c => c.recordId === v.id))) throw new Error('Resolve conflicts before importing updates to these records.');
    this.beforeMutation(); const before = values.map(v => ({ id: v.id, value: this.get(v.id) }));
    this.db.transaction(() => { for (const value of values) this.write(value.id, value, true); this.db.prepare('INSERT INTO import_batches VALUES (?,?,?,?)').run(batchId, new Date().toISOString(), JSON.stringify(before), JSON.stringify(values)); })();
    return batchId;
  }
  undoImport(batchId: string): void {
    const batch = this.db.prepare('SELECT * FROM import_batches WHERE id=?').get(batchId) as { before_payload: string; after_payload: string } | undefined;
    if (!batch) throw new Error('Import batch not found.'); const after = JSON.parse(batch.after_payload) as DomainRecord[];
    if (after.some(v => digest(this.get(v.id)) !== digest(v))) throw new Error('Some imported items have changed. Review those changes before undoing the import.');
    const before = JSON.parse(batch.before_payload) as Array<{ id: string; value: DomainRecord | null }>;
    this.beforeMutation(); this.db.transaction(() => { for (const value of before) this.write(value.id, value.value, true); this.db.prepare('DELETE FROM import_batches WHERE id=?').run(batchId); })();
  }
  queue(): Mutation[] { return (this.db.prepare('SELECT * FROM outbox ORDER BY position').all() as any[]).map(r => ({ id: r.id, order: r.position, recordId: r.record_id, baseVersion: r.base_version, base: parse<DomainRecord>(r.base_payload), value: parse<DomainRecord>(r.payload), state: r.state, attempts: r.attempts })); }
  markSending(id: string): void { this.db.prepare("UPDATE outbox SET state='sending',attempts=attempts+1 WHERE id=?").run(id); }
  resetMutation(id: string, permanent = false): void { this.db.prepare('UPDATE outbox SET state=? WHERE id=?').run(permanent ? 'failed' : 'pending', id); }
  retryFailed(): void { this.db.prepare("UPDATE outbox SET state='pending' WHERE state='failed'").run(); }
  shadow(id: string): RemoteRecord | null { const row = this.db.prepare('SELECT * FROM shadows WHERE id=?').get(id) as any; return row ? { id, value: parse<DomainRecord>(row.payload), version: row.version, sequence: row.sequence } : null; }
  private writeShadow(remote: RemoteRecord): void { this.db.prepare('INSERT OR REPLACE INTO shadows VALUES (?,?,?,?)').run(remote.id, remote.value ? JSON.stringify(remote.value) : null, remote.version, remote.sequence); }
  acknowledge(mutation: Mutation, remote: RemoteRecord): void {
    this.db.transaction(() => {
      this.writeShadow(remote); this.db.prepare('DELETE FROM outbox WHERE id=?').run(mutation.id);
      const next = this.db.prepare('SELECT id FROM outbox WHERE record_id=? ORDER BY position LIMIT 1').get(mutation.recordId) as { id: string } | undefined;
      if (next) this.db.prepare('UPDATE outbox SET base_version=?,base_payload=? WHERE id=?').run(remote.version, remote.value ? JSON.stringify(remote.value) : null, next.id);
      else this.write(remote.id, remote.value, false);
    })();
  }
  applyRemote(records: RemoteRecord[], completedCursor?: number): void {
    this.db.transaction(() => {
      for (const remote of records) {
        if (remote.value) { parseRecord(remote.value); if (remote.value.id !== remote.id) throw new Error('Cloud record identity does not match its path.'); }
        if ((this.shadow(remote.id)?.sequence ?? -1) > remote.sequence) continue;
        this.writeShadow(remote);
        if (!this.db.prepare('SELECT id FROM outbox WHERE record_id=? LIMIT 1').get(remote.id) && !this.conflicts().some(c => c.recordId === remote.id)) this.write(remote.id, remote.value, false);
      }
      if (completedCursor !== undefined) this.setMetadata('cursor', completedCursor);
    })();
  }
  conflict(mutation: Mutation, remote: RemoteRecord | null): void {
    this.db.transaction(() => {
      this.db.prepare('INSERT OR REPLACE INTO conflicts VALUES (?,?,?,?,?,?)').run(randomUUID(), mutation.recordId, mutation.base ? JSON.stringify(mutation.base) : null, this.get(mutation.recordId) ? JSON.stringify(this.get(mutation.recordId)) : null, remote?.value ? JSON.stringify(remote.value) : null, remote?.version ?? null);
      this.db.prepare("UPDATE outbox SET state='conflict' WHERE record_id=?").run(mutation.recordId); if (remote) this.writeShadow(remote);
    })();
  }
  conflicts(): Conflict[] { return (this.db.prepare('SELECT * FROM conflicts').all() as any[]).map(r => ({ id: r.id, recordId: r.record_id, base: parse<DomainRecord>(r.base), local: parse<DomainRecord>(r.local), remote: parse<DomainRecord>(r.remote), remoteVersion: r.remote_version })); }
  resolve(conflictId: string, choice: 'local' | 'remote' | 'both', current: RemoteRecord | null): void {
    const conflict = this.conflicts().find(c => c.id === conflictId); if (!conflict) throw new Error('This conflict has already been resolved.');
    if ((current?.version ?? null) !== conflict.remoteVersion) { this.conflict({ id: '', order: 0, recordId: conflict.recordId, baseVersion: conflict.remoteVersion, base: conflict.remote, value: conflict.local, state: 'conflict', attempts: 0 }, current); throw new Error('The cloud item changed again. Review the updated comparison.'); }
    this.beforeMutation();
    this.db.transaction(() => {
      this.db.prepare('DELETE FROM outbox WHERE record_id=?').run(conflict.recordId); this.db.prepare('DELETE FROM conflicts WHERE id=?').run(conflictId);
      if (current) this.writeShadow(current);
      if (choice === 'remote' || choice === 'both' || !current?.value) this.write(conflict.recordId, current?.value ?? null, false);
      if (choice === 'local' && current?.value) this.write(conflict.recordId, conflict.local, true);
      else if ((choice === 'both' || choice === 'local') && conflict.local) { const newId = randomUUID(); this.write(newId, { ...conflict.local, id: newId }, true); }
    })();
  }
  reminders(): ReminderEntry[] { return (this.db.prepare('SELECT payload FROM reminders ORDER BY due_ms DESC').all() as Array<{ payload: string }>).map(r => JSON.parse(r.payload)); }
  putReminder(entry: ReminderEntry): void { this.db.prepare('INSERT OR REPLACE INTO reminders VALUES (?,?,?,?)').run(entry.id, JSON.stringify(entry), entry.snoozeMs ?? entry.dueMs, entry.state); }
  delivered(id: string): number | null { const row = this.db.prepare('SELECT due_ms FROM delivery_markers WHERE id=?').get(id) as { due_ms: number } | undefined; return row?.due_ms ?? null; }
  markDelivered(id: string, dueMs: number): void { this.db.prepare('INSERT OR REPLACE INTO delivery_markers VALUES (?,?)').run(id, dueMs); }
  pruneReminders(now: number): void { this.db.prepare("DELETE FROM reminders WHERE due_ms < ? AND state NOT IN ('pending','snoozed','dispatching')").run(now - 90 * 86400000); }
  close(): void { if (!this.closed) { this.db.close(); this.closed = true; } }
}
