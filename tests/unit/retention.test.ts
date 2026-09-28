import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { LocalStore } from '../../src/main/store';
import { ReminderScheduler } from '../../src/main/scheduler';
import { defaultDeviceSettings } from '../../src/shared/model';
import { item } from '../fixtures';

let root: string, now: number;
let stores: LocalStore[], scheduler: ReminderScheduler | undefined;
const open = (account = 'retention-a') => { const store = new LocalStore(root, account); stores.push(store); return store; };
const undoRows = (store: LocalStore) => store.db.prepare('SELECT * FROM undo ORDER BY id').all();
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-lime-retention-')); stores = [];
  now = Date.parse('2026-09-28T12:00:00Z'); vi.spyOn(Date, 'now').mockImplementation(() => now);
});
afterEach(() => {
  scheduler?.stop(); scheduler = undefined; stores.forEach(store => store.close());
  vi.useRealTimers(); vi.restoreAllMocks();
  if (!path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep) || !path.basename(root).startsWith('cc-lime-retention-')) throw new Error('Unsafe test cleanup path');
  fs.rmSync(root, { recursive: true, force: true });
});

describe('expired quick-undo minimization', () => {
  it('keeps just-before and exact-expiry undo valid, and removes it only after expiry', () => {
    const store = open(), value = item(), saved = store.save(value);
    now += 9999; expect(store.pruneExpiredUndo()).toBe(true); expect(undoRows(store)).toHaveLength(1);
    now++; expect(store.pruneExpiredUndo()).toBe(true); store.undo(saved.undoToken);
    expect(store.get(value.id)).toBeNull(); expect(undoRows(store)).toHaveLength(0);
    const next = store.save(value); now += 10001;
    expect(() => store.undo(next.undoToken)).toThrow('undo period has ended'); expect(undoRows(store)).toHaveLength(0);
    expect(store.get(value.id)).toEqual(value);
  });
  it('cleans expired rows on reopen without changing records, pending writes or valid undo', () => {
    const store = open(), first = item(); store.save(first); now += 5000;
    const second = item(), saved = store.save(second), records = store.list(), queue = store.queue();
    store.close(); now += 5001;
    const reopened = open(); expect(reopened.list()).toEqual(records); expect(reopened.queue()).toEqual(queue);
    expect(undoRows(reopened)).toHaveLength(1); reopened.undo(saved.undoToken); expect(reopened.get(second.id)).toBeNull();
  });
  it('keeps unrelated durable history and another account unchanged', () => {
    const store = open(), other = open('retention-b'), value = item();
    store.save(value); other.save(item()); const imported = item(); store.importRecords([imported]);
    const mutation = store.queue()[0];
    store.conflict(mutation, { id: value.id, value: { ...value, title: 'Remote fixture' }, version: 'v1', sequence: 1 });
    store.markDelivered('synthetic-marker', now);
    const tables = ['records', 'shadows', 'outbox', 'conflicts', 'metadata', 'import_batches', 'delivery_markers'];
    const before = tables.map(table => store.db.prepare(`SELECT * FROM ${table}`).all());
    now += 10001; store.pruneExpiredUndo();
    expect(undoRows(store)).toHaveLength(0); expect(undoRows(other)).toHaveLength(1);
    expect(tables.map(table => store.db.prepare(`SELECT * FROM ${table}`).all())).toEqual(before);
  });
  it('removes expired content before a new snapshot but leaves existing snapshots intact', () => {
    const store = open(); store.save(item()); const prior = store.snapshot('manual');
    const priorBytes = fs.readFileSync(prior); now += 10001; const next = store.snapshot('manual');
    const inspect = new Database(next, { readonly: true });
    try { expect(inspect.prepare('SELECT COUNT(*) AS count FROM undo').get()).toEqual({ count: 0 }); }
    finally { inspect.close(); }
    expect(fs.readFileSync(prior)).toEqual(priorBytes); expect(undoRows(store)).toHaveLength(0);
  });
  it('does not require an undo table in a pre-migration snapshot', () => {
    const store = open(); store.db.exec('DROP TABLE undo');
    expect(fs.existsSync(store.snapshot('pre-migration'))).toBe(true);
  });
  it('cleans on a new mutation without altering its undo or losing the old queued save', () => {
    const store = open(), first = item(); store.save(first); now += 10001;
    const second = item(), saved = store.save(second);
    expect(undoRows(store)).toHaveLength(1); expect(store.queue()).toHaveLength(2);
    store.undo(saved.undoToken); expect(store.get(first.id)).toEqual(first); expect(store.get(second.id)).toBeNull();
  });
  it('cleans an idle active account through the existing scheduler timer', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const store = open(); store.save(item({ reminders: [] }));
    scheduler = new ReminderScheduler(store, () => ({ ...defaultDeviceSettings }), () => 'UTC', () => {}, () => {}, () => now);
    scheduler.start(); expect(undoRows(store)).toHaveLength(1);
    now += 60000; vi.advanceTimersByTime(60000); expect(undoRows(store)).toHaveLength(0);
  });
  it('retries a storage-denied cleanup without accepting expired undo or losing saved data', () => {
    const store = open(), value = item(), saved = store.save(value); now += 10001;
    store.db.pragma('query_only = ON'); expect(store.pruneExpiredUndo()).toBe(false);
    expect(() => store.undo(saved.undoToken)).toThrow('undo period has ended'); expect(store.get(value.id)).toEqual(value);
    store.db.pragma('query_only = OFF');
    store.db.exec("CREATE TRIGGER deny_undo_cleanup BEFORE DELETE ON undo BEGIN SELECT RAISE(FAIL, 'synthetic cleanup failure'); END");
    const next = item(); expect(store.save(next).record).toEqual(next); expect(store.queue()).toHaveLength(2);
    scheduler = new ReminderScheduler(store, () => ({ ...defaultDeviceSettings }), () => 'UTC', () => {}, () => {}, () => now);
    expect(() => scheduler!.reconcile(false)).not.toThrow(); expect(undoRows(store)).toHaveLength(2);
    store.db.exec('DROP TRIGGER deny_undo_cleanup'); expect(store.pruneExpiredUndo()).toBe(true);
    expect(undoRows(store)).toHaveLength(1); expect(store.list()).toHaveLength(2); expect(store.queue()).toHaveLength(2);
  });
});
