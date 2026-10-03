import { afterEach, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AttemptWindow, CommandRateLimits, ProviderCooldown, RateLimitError, retryAfterMs } from '../../src/main/rate-limit';
import { FirestoreCloud, CloudError, type CloudAdapter } from '../../src/main/cloud';
import { SyncEngine } from '../../src/main/sync';
import { LocalStore } from '../../src/main/store';
import { AuthService } from '../../src/main/auth';
import { item } from '../fixtures';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
it('counts attempts exactly and denials never extend the window', () => {
  let now = 0; const limit = new AttemptWindow(2, 60_000, () => now);
  limit.take(); limit.take(); now = 1000;
  expect(() => limit.take()).toThrow('59 seconds');
  now = 59_999; expect(() => limit.take()).toThrow('1 seconds');
  now = 60_000; expect(() => limit.take()).not.toThrow();
});
it('shares related command budgets but preserves recovery, sign-out and local calendar actions', () => {
  const limits = new CommandRateLimits(() => 0);
  for (let i = 0; i < 10; i++) limits.take(i % 2 ? 'auth.signIn' : 'auth.google');
  expect(() => limits.take('auth.signUp')).toThrow(RateLimitError);
  for (let i = 0; i < 3; i++) limits.take(i % 2 ? 'auth.reset' : 'auth.verify');
  expect(() => limits.take('auth.reset')).toThrow(RateLimitError);
  for (const command of ['auth.cancel', 'auth.signOut', 'save', 'account.delete', 'snapshot', 'undo', 'sync']) expect(() => limits.take(command)).not.toThrow();
  // Untrusted names do not allocate keys or evade a real command's shared policy.
  for (let i = 0; i < 1000; i++) limits.take(`unknown-${i}`);
  expect(() => limits.take('auth.signIn')).toThrow(RateLimitError);
});
it.each([
  [{ 'retry-after': '12' }, 12_000], [{ 'retry-after': '1.25' }, 1250],
  [{ 'retry-after': 'Wed, 21 Oct 2015 07:29:00 GMT', date: 'Wed, 21 Oct 2015 07:28:00 GMT' }, 60_000],
  [{}, 60_000], [{ 'retry-after': 'invalid' }, 60_000], [{ 'retry-after': '-1' }, 60_000],
  [{ 'retry-after': '999999999' }, 86_400_000],
])('interprets provider waits safely (%j)', (headers, expected) => {
  expect(retryAfterMs(new Headers(headers as Record<string, string>), Date.UTC(2026, 8, 26))).toBe(expected);
});
it('retains a provider hold on a monotonic clock', () => {
  let now = 0; const cooldown = new ProviderCooldown(() => now);
  expect(() => cooldown.observe(new Response('not JSON', { status: 429, headers: { 'Retry-After': '30' } }))).toThrow(RateLimitError);
  now = 29_999; expect(() => cooldown.check()).toThrow(RateLimitError);
  now = 30_000; expect(() => cooldown.check()).not.toThrow();
});
it('does not parse a non-JSON 429 or retry the provider during its hold', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response('busy', { status: 429, headers: { 'Retry-After': '90' } }));
  vi.stubGlobal('fetch', fetcher);
  const cloud = new FirestoreCloud('demo-cc-lime', 'alice', async () => 'synthetic-token');
  await expect(cloud.head()).rejects.toMatchObject({ retryAfterMs: 90_000 });
  await expect(cloud.head()).rejects.toBeInstanceOf(RateLimitError);
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it('keeps authentication cooldowns across sign-out without sending another request', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-lime-rate-'));
  const fetcher = vi.fn().mockResolvedValue(new Response('busy', { status: 429, headers: { 'Retry-After': '90' } }));
  vi.stubGlobal('fetch', fetcher);
  try {
    const auth = new AuthService({ projectId: 'demo-cc-lime', apiKey: 'synthetic-test-key' }, root, { isEncryptionAvailable: () => false, encryptString: () => Buffer.alloc(0), decryptString: () => '' }, async () => {});
    await expect(auth.resetPassword('student@example.test')).rejects.toBeInstanceOf(RateLimitError);
    auth.signOut(); await expect(auth.signIn('student@example.test', 'test-password')).rejects.toBeInstanceOf(RateLimitError);
    expect(fetcher).toHaveBeenCalledTimes(1);
  } finally { if (path.dirname(root) === path.resolve(os.tmpdir()) && path.basename(root).startsWith('cc-lime-rate-')) fs.rmSync(root, { recursive: true, force: true }); }
});
it('keeps durable changes pending and prevents manual/focus/save bypass of a sync hold', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-lime-rate-'));
  const store = new LocalStore(root, 'alice'); let now = 0, attempts = 0, sequence = 0;
  const cloud: CloudAdapter = {
    get: async () => null, changes: async () => [], head: async () => sequence,
    commit: async mutation => {
      if (++attempts === 1) throw new CloudError('Quota reached', 'RESOURCE_EXHAUSTED', 429, 30_000);
      return { id: mutation.recordId, value: mutation.value, version: `v${++sequence}`, sequence };
    },
  };
  const engine = new SyncEngine(store, cloud, () => ({ uid: 'alice', email: 'student@example.test', displayName: 'Student', verified: true, providers: ['password'] }), () => {}, () => now);
  try {
    store.save(item()); await engine.sync(); expect(store.queue()[0].state).toBe('pending'); expect(engine.status.message).toContain('30 seconds');
    store.save(item()); engine.schedule(0); engine.setVisible(true); await engine.retry(); await engine.sync(); expect(attempts).toBe(1);
    now = 29_999; await engine.retry(); expect(attempts).toBe(1);
    now = 30_000; await engine.sync(); expect(attempts).toBe(3); expect(store.queue()).toHaveLength(0); expect(engine.status.state).toBe('synced');
  } finally { await engine.stop(); store.close(); if (path.dirname(root) === path.resolve(os.tmpdir()) && path.basename(root).startsWith('cc-lime-rate-')) fs.rmSync(root, { recursive: true, force: true }); }
});
