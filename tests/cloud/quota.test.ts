import { beforeEach, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { FirestoreCloud, encode, decode } from '../../src/main/cloud';
import type { Mutation } from '../../src/main/store';
import { item } from '../fixtures';

const project = 'demo-cc-lime', origin = 'http://127.0.0.1:8080';
const root = `projects/${project}/databases/(default)/documents`;
const base = `${origin}/v1/${root}`;
function token(uid: string) {
  const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');
  return `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ iss: `https://securetoken.google.com/${project}`, aud: project, sub: uid, user_id: uid, email_verified: true, iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000)+3600, auth_time: Math.floor(Date.now()/1000), firebase: { sign_in_provider: 'password', identities: {} } })}.`;
}
const headers = (uid = 'alice') => ({ Authorization: `Bearer ${token(uid)}`, 'Content-Type': 'application/json' });
const cloud = (uid = 'alice') => new FirestoreCloud(project, uid, async () => token(uid), origin);
const mutation = (): Mutation => { const value = item(); return { id: randomUUID(), recordId: value.id, value, base: null, baseVersion: null, order: 1, state: 'pending', attempts: 0 }; };
const fields = (object: object) => Object.fromEntries(Object.entries(object).map(([key, value]) => [key, encode(value)]));
async function head(uid = 'alice') { const response = await fetch(`${base}/users/${uid}/system/sync`, { headers: headers(uid) }); return response.status === 404 ? null : response.json(); }
async function seedQuota(count?: number, ago = 0) {
  const env = await initializeTestEnvironment({ projectId: project, firestore: { host: '127.0.0.1', port: 8080 } });
  try {
    await env.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), 'users/alice/system/sync'), {
        ownerId: 'alice', sequence: 1, mutationId: randomUUID(), recordIds: [randomUUID()],
        ...(count === undefined ? {} : { rateWindowCount: count, rateWindowStart: Timestamp.fromMillis(Date.now() - ago) }),
      });
    });
  } finally { await env.cleanup(); }
}
async function rawWrite(options: { count?: number; reset?: boolean; omit?: boolean; forgedTime?: string; uid?: string } = {}) {
  const uid = options.uid ?? 'alice', before = await head(uid), value = item(), group = randomUUID();
  const sequence = before ? decode(before.fields.sequence) + 1 : 1;
  const next = fields({ ownerId: uid, sequence, mutationId: group, recordIds: [value.id], ...(options.omit ? {} : { rateWindowCount: options.count ?? (before ? decode(before.fields.rateWindowCount) + 1 : 1) }) });
  if (!options.omit && !options.reset) next.rateWindowStart = options.forgedTime ? { timestampValue: options.forgedTime } : before.fields.rateWindowStart;
  const writes = [
    { update: { name: `${root}/users/${uid}/records/${value.id}`, fields: fields({ ownerId: uid, schemaVersion: 1, kind: 'item', payload: value, deleted: false, changeSeq: sequence, lastMutationId: group }) }, currentDocument: { exists: false }, updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }] },
    { update: { name: `${root}/users/${uid}/receipts/${group}`, fields: fields({ ownerId: uid, recordIds: [value.id], sequence, payloadHash: '0'.repeat(64) }) }, currentDocument: { exists: false } },
    { update: { name: `${root}/users/${uid}/system/sync`, fields: next }, currentDocument: before ? { updateTime: before.updateTime } : { exists: false }, ...(options.reset && !options.omit ? { updateTransforms: [{ fieldPath: 'rateWindowStart', setToServerValue: 'REQUEST_TIME' }] } : {}) },
  ];
  return fetch(`${base}:commit`, { method: 'POST', headers: headers(uid), body: JSON.stringify({ writes }) });
}
beforeEach(async () => { await fetch(`${origin}/emulator/v1/projects/${project}/databases/(default)/documents`, { method: 'DELETE' }); });

it('enforces all 60 accepted slots through the real rules, including raw REST slot 61', async () => {
  const a = cloud(); for (let i = 0; i < 60; i++) await a.commit(mutation());
  const before = await head(); expect(decode(before.fields.rateWindowCount)).toBe(60);
  expect((await rawWrite()).status).toBe(403);
  await expect(a.commit(mutation())).rejects.toMatchObject({ code: 'RESOURCE_EXHAUSTED', status: 429 });
  expect((await head()).updateTime).toBe(before.updateTime);
  await expect(cloud('bob').commit(mutation())).resolves.toMatchObject({ sequence: 1 });
}, 60_000);
it.each([
  { count: 1 }, { count: 59 }, { count: 1, reset: true }, { omit: true },
  { count: 1, forgedTime: '2000-01-01T00:00:00Z' },
  { count: 1, forgedTime: '2099-01-01T00:00:00Z' },
])('denies a forged or missing quota (%j) without partially writing', async options => {
  await seedQuota(60); const before = await head(); expect((await rawWrite(options)).status).toBe(403);
  expect((await head()).updateTime).toBe(before.updateTime); expect(await cloud().changes(0, 1)).toEqual([]);
});
it('does not let active users delete the counter to obtain a fresh window', async () => {
  await seedQuota(60); expect((await fetch(`${base}/users/alice/system/sync`, { method: 'DELETE', headers: headers() })).status).toBe(403);
});
it('migrates a legacy head and resets an expired window using server time', async () => {
  for(const count of [undefined,60]){
    await seedQuota(count,65_000);const change=mutation();await cloud().commit(change);const result=await head();expect(decode(result.fields.rateWindowCount)).toBe(1);
    const record=await(await fetch(`${base}/users/alice/records/${change.recordId}`,{headers:headers()})).json();
    // REQUEST_TIME belongs to the atomic request; commit updateTime can be later.
    expect(result.fields.rateWindowStart.timestampValue).toBe(record.fields.updatedAt.timestampValue);
  }
});
it('allocates the last slot once across racing devices and recovers the receipt without charging again', async () => {
  await seedQuota(59); const a = cloud(), b = cloud(), first = mutation(), second = mutation();
  const results = await Promise.allSettled([a.commit(first), b.commit(second)]);
  expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
  expect((results.find(r => r.status === 'rejected') as PromiseRejectedResult).reason).toMatchObject({ status: 429 });
  const accepted = results[0].status === 'fulfilled' ? first : second;
  await expect(cloud().commit(accepted)).resolves.toMatchObject({ sequence: 2 });
  expect(decode((await head()).fields.rateWindowCount)).toBe(60);
});
