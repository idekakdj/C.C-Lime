import fs from 'node:fs';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, collection, setDoc } from 'firebase/firestore';
import { randomUUID } from 'node:crypto';
import { FirestoreCloud } from '../../src/main/cloud';
import { item } from '../fixtures';
// @ts-expect-error The staging helper is deliberately plain Node JavaScript.
import { mfaRulesCandidate } from '../../scripts/mfa-rules-candidate.mjs';

// Isolated demo project: never changes the emulator's baseline project/rules.
const projectId = 'demo-cc-lime-mfa';
let env: RulesTestEnvironment;
beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId, firestore: {
    host: '127.0.0.1', port: 8080,
    rules: mfaRulesCandidate(fs.readFileSync('cloud/firestore.rules', 'utf8')),
  } });
});
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'users/alice/records/fixture'), { ownerId: 'alice', payload: { title: 'Private fixture' } });
  });
});
afterAll(async () => { await env?.cleanup(); });

function account(firebase?: object, extra: object = {}, uid = 'alice', verified = true) {
  // Deliberately exercise malformed/unsupported emulator claims beyond SDK types.
  const claims = { email_verified: verified, ...(firebase ? { firebase } : {}), ...extra };
  return env.authenticatedContext(uid, claims as unknown as Parameters<RulesTestEnvironment['authenticatedContext']>[1]).firestore();
}
it.each([
  { sign_in_provider: 'password', sign_in_second_factor: 'phone' },
  { sign_in_provider: 'password', sign_in_second_factor: 'totp' },
  { sign_in_provider: 'google.com' },
])('allows owner record/read-list with the accepted reserved claims %j', async claims => {
  const db = account(claims);
  await assertSucceeds(getDoc(doc(db, 'users/alice/records/fixture')));
  await assertSucceeds(getDocs(collection(db, 'users/alice/records')));
  const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const token = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({
    iss: `https://securetoken.google.com/${projectId}`, aud: projectId, sub: 'alice',
    user_id: 'alice', email_verified: true, iat: Math.floor(Date.now()/1000),
    exp: Math.floor(Date.now()/1000)+3600, auth_time: Math.floor(Date.now()/1000), firebase: claims,
  })}.`;
  const cloud = new FirestoreCloud(projectId, 'alice', async () => token, 'http://127.0.0.1:8080');
  const value = item();
  await expect(cloud.commit({ id: randomUUID(), recordId: value.id, value, base: null,
    baseVersion: null, order: 1, state: 'pending', attempts: 0 })).resolves.toMatchObject({ sequence: 1 });
  expect((await cloud.get(value.id))?.value).toEqual(value);
});
it.each([
  { sign_in_provider: 'password' },
  { sign_in_provider: 'password', sign_in_second_factor: '' },
  { sign_in_provider: 'password', sign_in_second_factor: 'sms' },
  { sign_in_provider: 'password', sign_in_second_factor: true },
  { sign_in_provider: 'password', identities: { phone: ['+15555550100'] } },
  { sign_in_provider: 'phone' },
  { sign_in_provider: 'anonymous' },
  { sign_in_provider: 'custom', sign_in_second_factor: 'phone' },
  {},
])('rejects first-factor-only, phone-only, missing or unsupported claims %j', async claims => {
  const db = account(claims);
  await assertFails(getDoc(doc(db, 'users/alice/records/fixture')));
  await assertFails(getDocs(collection(db, 'users/alice/records')));
  // A client-writable profile flag can never grant MFA access.
  await assertFails(setDoc(doc(db, 'users/alice/records/forged'), { ownerId: 'alice', mfaCompleted: true }));
});
it('rejects top-level/client flags, unsigned-out requests, wrong owners and unverified MFA accounts', async () => {
  for (const db of [
    account({ sign_in_provider: 'password' }, { mfaCompleted: true, sign_in_second_factor: 'phone', phone_number: '+15555550100' }),
    env.unauthenticatedContext().firestore(),
    account({ sign_in_provider: 'password', sign_in_second_factor: 'phone' }, {}, 'bob'),
    account({ sign_in_provider: 'password', sign_in_second_factor: 'phone' }, {}, 'alice', false),
  ]) await assertFails(getDoc(doc(db, 'users/alice/records/fixture')));
});
