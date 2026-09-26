import { beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { FirestoreCloud, VersionConflict, encode } from '../../src/main/cloud';
import type { Mutation } from '../../src/main/store';
import { item, recurrence } from '../fixtures';

const project = 'demo-cc-lime';
const origin = 'http://127.0.0.1:8080';
function token(uid = 'alice', verified = true) {
  const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');
  return `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ iss: `https://securetoken.google.com/${project}`, aud: project, sub: uid, user_id: uid, email: `${uid}@example.test`, email_verified: verified, iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000)+3600, auth_time: Math.floor(Date.now()/1000), firebase: { sign_in_provider: 'password', identities: {} } })}.`;
}
const cloud = (uid = 'alice', verified = true) => new FirestoreCloud(project, uid, async () => token(uid, verified), origin);
function mutation(value = item(), baseVersion: string | null = null): Mutation { return { id: randomUUID(), recordId: value.id, value, base: null, baseVersion, order: 1, state: 'pending', attempts: 0 }; }
async function rawCommit(value:ReturnType<typeof item>){
  const root=`projects/${project}/databases/(default)/documents/users/alice`,group=randomUUID();
  const fields=(object:object)=>Object.fromEntries(Object.entries(object).map(([key,value])=>[key,encode(value)]));
  const writes=[
    {update:{name:`${root}/records/${value.id}`,fields:fields({ownerId:'alice',schemaVersion:1,kind:value.kind,payload:value,deleted:false,changeSeq:1,lastMutationId:group})},currentDocument:{exists:false},updateTransforms:[{fieldPath:'updatedAt',setToServerValue:'REQUEST_TIME'}]},
    {update:{name:`${root}/receipts/${group}`,fields:fields({ownerId:'alice',recordIds:[value.id],sequence:1,payloadHash:'0'.repeat(64)})},currentDocument:{exists:false}},
    {update:{name:`${root}/system/sync`,fields:fields({ownerId:'alice',sequence:1,mutationId:group,recordIds:[value.id]})},currentDocument:{exists:false}},
  ];
  return fetch(`${origin}/v1/projects/${project}/databases/(default)/documents:commit`,{method:'POST',headers:{Authorization:`Bearer ${token()}`,'Content-Type':'application/json'},body:JSON.stringify({writes})});
}
beforeEach(async () => { await fetch(`${origin}/emulator/v1/projects/${project}/databases/(default)/documents`, { method: 'DELETE' }); });

describe('Firestore protocol with deployed authorization rules', () => {
  it('accepts the raw request control used for adversarial payload checks',async()=>{expect((await rawCommit(item())).status).toBe(200);});
  it.each([
    {timing:{mode:'timed',start:'not-a-time',end:'not-a-time',zone:'UTC'}},
    {reminders:[{id:randomUUID(),minutesBefore:-1}]},
    {recurrence:{...recurrence(),interval:0}},
    {recurrence:{...recurrence(),weekdays:[9]}},
    {recurrence:{...recurrence(),extraField:'forged'}},
    {estimatedMinutes:'too long'},
  ])('rejects a malformed nested calendar payload (%j)',async patch=>{
    const value={...item(),...patch} as any;
    const response=await rawCommit(value);expect(response.status).toBe(403);expect((await response.json()).error.status).toBe('PERMISSION_DENIED');
    expect(await cloud().head()).toBe(0);
  });
  it('accepts four recurring records with five reminders each within the rule expression budget',async()=>{
    const changes=Array.from({length:4},()=>mutation(item({recurrence:recurrence({until:'2026-12-18'}),reminders:Array.from({length:5},(_,i)=>({id:randomUUID(),minutesBefore:i*15}))})));
    expect(await cloud().commitGroup(changes,randomUUID())).toHaveLength(4);
  });
  it('resumes deletion while denying stale clients permission to recreate records',async()=>{
    const a=cloud(),first=mutation();await a.commit(first);await a.beginDeletion();
    await expect(a.commit(mutation())).rejects.toMatchObject({code:'PERMISSION_DENIED'});
    const response=await fetch(`${origin}/v1/projects/${project}/databases/(default)/documents/users/alice/system/deletion`,{method:'DELETE',headers:{Authorization:`Bearer ${token()}`}});expect(response.status).toBe(403);
    const resumed=cloud();expect(await resumed.deletionStarted()).toBe(true);await resumed.deleteCalendarData();expect(await resumed.get(first.recordId)).toBeNull();expect(await resumed.receipt(first.id)).toBeNull();expect(await resumed.head()).toBe(0);await resumed.deleteCalendarData();await expect(resumed.commit(mutation())).rejects.toMatchObject({code:'PERMISSION_DENIED'});
  });
  it('permits exactly four atomic domain records plus one head and receipt within rule limits', async () => {
    const a = cloud(); const mutations = Array.from({ length: 4 }, () => mutation()); const group = randomUUID();
    const saved = await a.commitGroup(mutations, group);
    expect(saved.map(v => v.sequence)).toEqual([1,1,1,1]); expect(await a.changes(0, 1)).toHaveLength(4);
    expect(await a.commitGroup(mutations, group)).toEqual(saved); expect(await a.head()).toBe(1);
    await expect(a.commitGroup([...mutations, mutation()], randomUUID())).rejects.toThrow('one to four');
  });
  it('atomically creates a record, receipt and head; reads it incrementally', async () => {
    const a = cloud(); const m = mutation(); const saved = await a.commit(m);
    expect(saved.sequence).toBe(1); expect(saved.version).toBeTruthy(); expect(await a.head()).toBe(1);
    expect((await a.get(m.recordId))?.value).toEqual(m.value);
    expect((await a.changes(0, 1)).map(v => v.id)).toEqual([m.recordId]);
    expect(await a.changes(1, 1)).toEqual([]);
  });
  it('recovers a lost response and duplicate submission without a second logical mutation', async () => {
    const a = cloud(); const m = mutation(); const first = await a.commit(m); const recovered = await a.commit(m);
    expect(recovered).toEqual(first); expect(await a.head()).toBe(1);
  });
  it('rejects an unrelated payload reusing an existing mutation identity', async () => {
    const a = cloud(); const m = mutation(); await a.commit(m);
    await expect(a.commit({ ...m, value: { ...m.value!, title: 'Forged retry' } as any })).rejects.toThrow('identity mismatch');
  });
  it('concurrent edits never overwrite a newer version', async () => {
    const a = cloud(); const b = cloud(); const m = mutation(); const first = await a.commit(m);
    const attempts = await Promise.allSettled([a.commit({ ...mutation({ ...m.value!, title: 'Device A' } as any, first.version), base: m.value }), b.commit({ ...mutation({ ...m.value!, title: 'Device B' } as any, first.version), base: m.value })]);
    expect(attempts.filter(v => v.status === 'fulfilled')).toHaveLength(1);
    expect((attempts.find(v => v.status === 'rejected') as PromiseRejectedResult).reason).toBeInstanceOf(VersionConflict);
    expect(await a.head()).toBe(2);
  });
  it('different records retry a raced sync head and both survive', async () => {
    const a = cloud(); const b = cloud(); await Promise.all([a.commit(mutation()), b.commit(mutation())]);
    expect(await a.head()).toBe(2); expect(await a.changes(0, 2)).toHaveLength(2);
  });
  it('tombstones are visible to pulls and stale edits cannot resurrect them', async () => {
    const a = cloud(); const m = mutation(); const first = await a.commit(m);
    await a.commit({ ...m, id: randomUUID(), base: m.value, baseVersion: first.version, value: null });
    expect((await a.changes(1, 2))[0].value).toBeNull();
    await expect(a.commit({ ...m, id: randomUUID(), baseVersion: first.version })).rejects.toBeInstanceOf(VersionConflict);
  });
  it('rejects cross-account reads and all unverified writes', async () => {
    const a = cloud(); const m = mutation(); await a.commit(m);
    const forged = new FirestoreCloud(project, 'alice', async () => token('mallory'), origin);
    await expect(forged.get(m.recordId)).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    await expect(cloud('unverified', false).commit(mutation())).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
  });
  it('rejects direct record writes without the atomic head and receipt', async () => {
    const m = mutation(); const envelope = { ownerId: 'alice', schemaVersion: 1, kind: 'item', payload: m.value, deleted: false, changeSeq: 1, lastMutationId: m.id };
    const response = await fetch(`${origin}/v1/projects/${project}/databases/(default)/documents/users/alice/records/${m.recordId}`, { method: 'PATCH', headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: Object.fromEntries(Object.entries(envelope).map(([k,v]) => [k,encode(v)])) }) });
    expect(response.status).toBe(403);
  });
});
