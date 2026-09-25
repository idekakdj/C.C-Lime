import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { LocalStore, type RemoteRecord } from '../../src/main/store';
import { courseSchema, semesterSchema } from '../../src/shared/model';
import { item } from '../fixtures';
let root: string; let stores: LocalStore[];
const open = (uid = 'student-a') => { const store = new LocalStore(root, uid); stores.push(store); return store; };
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-lime-tests-')); stores = []; });
afterEach(() => { stores.forEach(store => store.close()); if (!path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep) || !path.basename(root).startsWith('cc-lime-tests-')) throw Error('Unsafe test cleanup path'); fs.rmSync(root, { recursive: true, force: true }); });

describe('durable local storage and recovery', () => {
  it('refreshes cached records after another connection commits and after a failed group',()=>{
    const a=open(),first=item(),second=item();a.save(first);a.save(second);a.list();
    const b=open();b.save({...first,title:'Changed elsewhere'});
    expect(a.list().find(r=>r.id===first.id)).toMatchObject({title:'Changed elsewhere'});
    expect(()=>a.saveGroup([{id:first.id,value:{...first,title:'Must roll back'}},{id:second.id,value:courseSchema.parse({id:second.id,kind:'course',name:'Invalid type replacement'})}])).toThrow('change its type');
    expect(a.list().find(r=>r.id===first.id)).toMatchObject({title:'Changed elsewhere'});
    expect(a.get(second.id)).toEqual(second);
  });
  it('saves records and their outgoing mutations atomically across restart', () => {
    const store = open(); const value = item(); store.save(value); expect(store.queue()).toHaveLength(1); store.close();
    const reopened = open(); expect(reopened.get(value.id)).toEqual(value); expect(reopened.queue()[0].value).toEqual(value);
  });
  it('isolates account databases and rejects invalid relationships', () => {
    const a = open(); const b = open('student-b'); const value = item(); a.save(value); expect(b.list()).toEqual([]);
    expect(() => a.save({ ...value, courseId: randomUUID() })).toThrow('course');
    expect(a.queue()).toHaveLength(1);
  });
  it('keeps later local edits while acknowledging an in-flight mutation', () => {
    const store = open(); const value = item(); store.save(value); const first = store.queue()[0]; store.markSending(first.id);
    const second = { ...value, title: 'Changed while sending' }; store.save(second);
    store.acknowledge(first, { id: value.id, value, version: 'v1', sequence: 1 });
    expect(store.get(value.id)).toEqual(second); expect(store.queue()[0].baseVersion).toBe('v1');
    const next = store.queue()[0]; store.acknowledge(next, { id: value.id, value: second, version: 'v2', sequence: 2 });
    expect(store.queue()).toEqual([]); expect(store.get(value.id)).toEqual(second);
  });
  it('makes an in-flight mutation retryable on restart', () => {
    const store = open(); store.save(item()); store.markSending(store.queue()[0].id); store.close();
    expect(open().queue()[0].state).toBe('pending');
  });
  it('does not overwrite pending edits during a cloud pull', () => {
    const store = open(); const value = item(); const remote: RemoteRecord = { id: value.id, value, version: 'v1', sequence: 1 };
    store.applyRemote([remote], 1); store.save({ ...value, title: 'Local proposal' });
    store.applyRemote([{ ...remote, value: { ...value, title: 'Remote edit' }, version: 'v2', sequence: 2 }], 2);
    expect(store.get(value.id)?.kind === 'item' && (store.get(value.id) as any).title).toBe('Local proposal');
    expect(store.queue()[0].baseVersion).toBe('v1'); expect(store.metadata('cursor', 0)).toBe(2);
  });
  it('preserves tombstones and resolves a delete/edit conflict as a new identity', () => {
    const store = open(); const value = item(); store.applyRemote([{ id: value.id, value, version: 'v1', sequence: 1 }]);
    store.save({ ...value, title: 'Offline edit' }); const mutation = store.queue()[0];
    const deletion = { id: value.id, value: null, version: 'v2', sequence: 2 }; store.conflict(mutation, deletion);
    store.resolve(store.conflicts()[0].id, 'local', deletion);
    const records = store.list(); expect(records).toHaveLength(1); expect(records[0].id).not.toBe(value.id);
    expect(store.queue()[0].recordId).toBe(records[0].id); expect(store.get(value.id)).toBeNull();
  });
  it('rejects conflict resolution when the remote version changed again', () => {
    const store = open(); const value = item(); store.save(value); const mutation = store.queue()[0];
    const remote = { id: value.id, value: { ...value, title: 'Remote' }, version: 'v1', sequence: 1 }; store.conflict(mutation, remote);
    expect(() => store.resolve(store.conflicts()[0].id, 'local', { ...remote, version: 'v2', sequence: 2 })).toThrow('changed again');
    expect(store.conflicts()[0].local).toEqual(value);
  });
  it('provides undo without discarding subsequent edits', () => {
    const store = open(); const value = item(); const saved = store.save(value); store.undo(saved.undoToken); expect(store.get(value.id)).toBeNull();
    const another = store.save(value); store.save({ ...value, title: 'Newer' }); expect(() => store.undo(another.undoToken)).toThrow('changed again');
  });
  it('creates a consistent daily backup and preserves it after restart', () => {
    const store = open(); store.save(item()); const backups = fs.readdirSync(path.join(store.directory, 'backups')); expect(backups.some(name => name.startsWith('daily-'))).toBe(true);
    store.save(item()); expect(fs.readdirSync(path.join(store.directory, 'backups'))).toHaveLength(1);
    store.close(); expect(open().list()).toHaveLength(2);
  });
  it('protects referenced courses and makes batch import all-or-nothing', () => {
    const store = open(); const semester = semesterSchema.parse({ id: randomUUID(), kind: 'semester', name: 'Fall', startDate: '2026-09-01', endDate: '2026-12-18', zone: 'America/Toronto' });
    const course = courseSchema.parse({ id: randomUUID(), kind: 'course', name: 'Algorithms', semesterId: semester.id });
    const assignment = item({ courseId: course.id }); store.importRecords([semester, course, assignment]);
    expect(() => store.remove(course.id)).toThrow('Archive');
    expect(() => store.importRecords([item(), { ...item(), title: '' }])).toThrow(); expect(store.list()).toHaveLength(3);
  });
  it('undoes imports only when records still match their imported values', () => {
    const store = open(); const value = item(); const batch = store.importRecords([value]); store.undoImport(batch); expect(store.get(value.id)).toBeNull();
    const nextBatch = store.importRecords([value]); store.save({ ...value, title: 'Updated' }); expect(() => store.undoImport(nextBatch)).toThrow('changed');
  });
});
