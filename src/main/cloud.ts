import { createHash } from 'node:crypto';
import { parseRecord, type DomainRecord } from '../shared/model';
import type { Mutation, RemoteRecord } from './store';

type FirestoreValue = { nullValue?: null; stringValue?: string; booleanValue?: boolean; integerValue?: string; doubleValue?: number; mapValue?: { fields: Record<string, FirestoreValue> }; arrayValue?: { values: FirestoreValue[] }; timestampValue?: string };
export function encode(value: unknown): FirestoreValue {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(value as object).map(([key, v]) => [key, encode(v)])) } };
}
export function decode(value: FirestoreValue): any {
  if ('nullValue' in value) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('timestampValue' in value) return value.timestampValue;
  if (value.arrayValue) return (value.arrayValue.values ?? []).map(decode);
  if (value.mapValue) return Object.fromEntries(Object.entries(value.mapValue.fields ?? {}).map(([key, v]) => [key, decode(v)]));
  throw new Error('Unsupported cloud value.');
}
function fields(value: object) { return Object.fromEntries(Object.entries(value).map(([key, v]) => [key, encode(v)])); }
function readFields(document: any) { return Object.fromEntries(Object.entries(document.fields ?? {}).map(([key, value]) => [key, decode(value as FirestoreValue)])); }
export class CloudError extends Error { constructor(message: string, readonly code: string, readonly status: number) { super(message); } }
export class VersionConflict extends Error { constructor(readonly current: RemoteRecord | null) { super('This item changed on another device.'); } }
export interface CloudAdapter {
  get(id: string): Promise<RemoteRecord | null>;
  commit(mutation: Mutation): Promise<RemoteRecord>;
  commitGroup?(mutations:Mutation[],groupId:string):Promise<RemoteRecord[]>;
  head(): Promise<number>;
  changes(after: number, through: number, afterId?: string): Promise<RemoteRecord[]>;
  deletionStarted?():Promise<boolean>;
}
export class FirestoreCloud implements CloudAdapter {
  readonly base: string;
  readonly root: string;
  operations = { reads: 0, writes: 0 };
  constructor(readonly projectId: string, readonly uid: string, private token: () => Promise<string>, emulatorOrigin?: string) {
    if (!/^[a-z0-9][a-z0-9-]{4,61}[a-z0-9]$/.test(projectId)) throw new Error('Invalid cloud project ID.');
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) throw new Error('Invalid account identity.');
    if (emulatorOrigin && !/^http:\/\/127\.0\.0\.1:\d+$/.test(emulatorOrigin)) throw new Error('Emulators must use a loopback address.');
    this.root = `projects/${projectId}/databases/(default)/documents`;
    this.base = `${emulatorOrigin ?? 'https://firestore.googleapis.com'}/v1/${this.root}`;
  }
  private name(suffix: string) { return `${this.root}/users/${this.uid}/${suffix}`; }
  private async request(suffix: string, init: RequestInit = {}): Promise<any> {
    const response = await fetch(`${this.base}${suffix}`, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await this.token()}`, ...init.headers }, signal: AbortSignal.timeout(20000) });
    if (response.status === 404) return null;
    if (response.status === 204) return true;
    const body = await response.json();
    if (!response.ok) throw new CloudError(body.error?.message ?? 'Cloud request failed.', body.error?.status ?? 'UNKNOWN', response.status);
    return body;
  }
  private fromDocument(document: any): RemoteRecord {
    const envelope = readFields(document); const id = document.name.split('/').at(-1);
    if (envelope.ownerId !== this.uid || envelope.schemaVersion !== 1) throw new CloudError('This cloud record uses an unsupported format.', 'SCHEMA_MISMATCH', 400);
    const value = envelope.deleted ? null : parseRecord(envelope.payload);
    if (value && value.id !== id) throw new CloudError('Invalid cloud record identity.', 'SCHEMA_MISMATCH', 400);
    return { id, value, version: document.updateTime, sequence: envelope.changeSeq };
  }
  async get(id: string): Promise<RemoteRecord | null> {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Invalid record identity.');
    this.operations.reads++; const doc = await this.request(`/users/${this.uid}/records/${id}`); return doc ? this.fromDocument(doc) : null;
  }
  private async rawHead(): Promise<{ sequence: number; version: string | null }> {
    this.operations.reads++; const doc = await this.request(`/users/${this.uid}/system/sync`);
    return doc ? { sequence: readFields(doc).sequence, version: doc.updateTime } : { sequence: 0, version: null };
  }
  async head(): Promise<number> { return (await this.rawHead()).sequence; }
  async receipt(id: string): Promise<{ sequence: number; payloadHash: string; recordIds: string[] } | null> {
    this.operations.reads++; const doc = await this.request(`/users/${this.uid}/receipts/${id}`); return doc ? readFields(doc) as any : null;
  }
  async commit(mutation: Mutation): Promise<RemoteRecord> {
    return (await this.commitGroup([mutation], mutation.id))[0];
  }
  async commitGroup(mutations: Mutation[], groupId: string): Promise<RemoteRecord[]> {
    if (mutations.length < 1 || mutations.length > 4 || new Set(mutations.map(m => m.recordId)).size !== mutations.length || !/^[0-9a-f-]{36}$/i.test(groupId)) throw new Error('An atomic group needs one to four distinct records and a UUID.');
    const ids = mutations.map(m => m.recordId);
    const hash = createHash('sha256').update(JSON.stringify(mutations.map(m => ({ id: m.recordId, value: m.value })))).digest('hex');
    const recover = async (receipt: { sequence: number; payloadHash: string; recordIds: string[] }) => {
      if (receipt.payloadHash !== hash || JSON.stringify(receipt.recordIds) !== JSON.stringify(ids)) throw new CloudError('Mutation identity mismatch.', 'INVALID_ARGUMENT', 400);
      const current = await Promise.all(ids.map(id => this.get(id)));
      for (const remote of current) if (!remote || remote.sequence !== receipt.sequence) throw new VersionConflict(remote);
      return current as RemoteRecord[];
    };
    const receipt = await this.receipt(groupId);
    if (receipt) {
      return recover(receipt);
    }
    for (let race = 0; race < 5; race++) {
      const current = await Promise.all(ids.map(id => this.get(id)));
      for (let i = 0; i < mutations.length; i++) if ((current[i]?.version ?? null) !== mutations[i].baseVersion) throw new VersionConflict(current[i]);
      const head = await this.rawHead(); const sequence = head.sequence + 1;
      const values = mutations.map(m => m.value ? parseRecord(m.value) : null);
      const writes = [
        ...mutations.map((m, i) => ({ update: { name: this.name(`records/${m.recordId}`), fields: fields({ ownerId: this.uid, schemaVersion: 1, kind: values[i]?.kind ?? m.base?.kind ?? 'item', payload: values[i], deleted: values[i] === null, changeSeq: sequence, lastMutationId: groupId }) }, currentDocument: current[i] ? { updateTime: current[i]!.version } : { exists: false }, updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }] })),
        { update: { name: this.name(`receipts/${groupId}`), fields: fields({ ownerId: this.uid, recordIds: ids, sequence, payloadHash: hash }) }, currentDocument: { exists: false } },
        { update: { name: this.name('system/sync'), fields: fields({ ownerId: this.uid, sequence, mutationId: groupId, recordIds: ids }) }, currentDocument: head.version ? { updateTime: head.version } : { exists: false } },
      ];
      try {
        const result = await this.request(':commit', { method: 'POST', body: JSON.stringify({ writes }) });
        this.operations.writes += writes.length; return mutations.map((m, i) => ({ id: m.recordId, value: values[i], sequence, version: result.writeResults[i].updateTime }));
      } catch (error) {
        if (error instanceof CloudError && ['FAILED_PRECONDITION', 'ABORTED', 'ALREADY_EXISTS', 'PERMISSION_DENIED'].includes(error.code)) {
          const acknowledged = await this.receipt(groupId);
          if (acknowledged) return recover(acknowledged);
          const latest = await Promise.all(ids.map(id => this.get(id)));
          for (let i = 0; i < mutations.length; i++) if ((latest[i]?.version ?? null) !== mutations[i].baseVersion) throw new VersionConflict(latest[i]);
          if (error.code === 'PERMISSION_DENIED' && (await this.rawHead()).version === head.version) throw error;
          continue;
        }
        throw error;
      }
    }
    throw new CloudError('Cloud data is busy. Your changes remain saved on this device.', 'ABORTED', 409);
  }
  async changes(after: number, through: number, afterId?: string): Promise<RemoteRecord[]> {
    const query: any = { from: [{ collectionId: 'records' }], where: { compositeFilter: { op: 'AND', filters: [
      { fieldFilter: { field: { fieldPath: 'changeSeq' }, op: afterId ? 'GREATER_THAN_OR_EQUAL' : 'GREATER_THAN', value: encode(after) } },
      { fieldFilter: { field: { fieldPath: 'changeSeq' }, op: 'LESS_THAN_OR_EQUAL', value: encode(through) } },
    ] } }, orderBy: [{ field: { fieldPath: 'changeSeq' }, direction: 'ASCENDING' }, { field: { fieldPath: '__name__' }, direction: 'ASCENDING' }], limit: 100 };
    if (afterId) query.startAt = { values: [encode(after), { referenceValue: this.name(`records/${afterId}`) }], before: false };
    const rows = await this.request(`/users/${this.uid}:runQuery`, { method: 'POST', body: JSON.stringify({ structuredQuery: query }) });
    const result = (rows ?? []).filter((row: any) => row.document).map((row: any) => this.fromDocument(row.document)); this.operations.reads += Math.max(1, result.length); return result;
  }
  async deletionStarted():Promise<boolean>{this.operations.reads++;return !!await this.request(`/users/${this.uid}/system/deletion`);}
  async beginDeletion():Promise<void>{
    await this.request(`/users/${this.uid}/system/deletion`,{method:'PATCH',body:JSON.stringify({fields:fields({enabled:true})})});this.operations.writes++;
  }
  async deleteCalendarData():Promise<void>{
    if(!await this.deletionStarted())throw new Error('Confirm account deletion before removing cloud data.');
    // Every batch is restartable. The immutable marker blocks old clients from
    // re-creating records while deletion proceeds, including after identity deletion.
    for(const collection of ['records','receipts']){
      for(let page=0;page<10000;page++){
        const result=await this.request(`/users/${this.uid}/${collection}?pageSize=100`);
        const documents=result?.documents??[];this.operations.reads+=Math.max(1,documents.length);
        if(!documents.length)break;
        for(const document of documents)if(!document.name.startsWith(this.name(`${collection}/`)))throw new Error('Unexpected cloud deletion path.');
        await this.request(':commit',{method:'POST',body:JSON.stringify({writes:documents.map((document:any)=>({delete:document.name}))})});this.operations.writes+=documents.length;
        if(page===9999)throw new Error('Deletion paused after a large batch. Resume to finish.');
      }
      const verify=await this.request(`/users/${this.uid}/${collection}?pageSize=1`);this.operations.reads++;
      if(verify?.documents?.length)throw new Error('Cloud data is still being removed. Resume deletion.');
    }
    await this.request(`/users/${this.uid}/system/sync`,{method:'DELETE'});this.operations.writes++;
  }
}
