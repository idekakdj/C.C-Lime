import { afterEach, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AuthService } from '../../src/main/auth';
const roots: string[] = [];
afterEach(() => vi.unstubAllGlobals());
const config = { projectId: 'demo-session-files', apiKey: 'synthetic-session-key' };
const saved = { projectId: config.projectId, refreshToken: 'synthetic-only-refresh', session: { uid: 'fixture', email: 'fixture@example.test', displayName: 'Fixture', verified: true, providers: ['password'] } };
// Serialization fixture only; this does not test Windows encryption.
const secure = { isEncryptionAvailable: () => true, encryptString: (value: string) => Buffer.from(value), decryptString: (value: Buffer) => value.toString() };
function fixture(changed = () => {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-lime-session-files-')); roots.push(root);
  return { root, committed: path.join(root, 'session.enc'), staged: path.join(root, 'session.enc.new'), auth: new AuthService(config, root, secure, async () => {}, changed) };
}
afterEach(() => { vi.restoreAllMocks(); for (const root of roots.splice(0)) { if (path.dirname(root) !== os.tmpdir() || !path.basename(root).startsWith('cc-lime-session-files-')) throw Error('Unsafe fixture cleanup'); fs.rmSync(root, { recursive: true, force: true }); } });
it('restore removes an orphan staged session without promoting it to a remembered identity', () => {
  const f = fixture(); fs.writeFileSync(f.staged, JSON.stringify(saved)); f.auth.restore();
  expect(fs.existsSync(f.staged)).toBe(false); expect(f.auth.session).toBeNull(); expect(f.auth.remembered).toBe(false);
});
it('orphan cleanup preserves the committed session and unrelated files', () => {
  const f = fixture(), bytes = JSON.stringify(saved); fs.writeFileSync(f.committed, bytes); fs.writeFileSync(f.staged, 'interrupted'); fs.writeFileSync(path.join(f.root, 'calendar-sentinel'), 'preserve');
  f.auth.restore(); expect(f.auth.session?.uid).toBe('fixture'); expect(f.auth.remembered).toBe(true); expect(fs.readFileSync(f.committed, 'utf8')).toBe(bytes); expect(fs.existsSync(f.staged)).toBe(false); expect(fs.readFileSync(path.join(f.root, 'calendar-sentinel'), 'utf8')).toBe('preserve');
});
it('sign-out removes committed and staged session files and clears the visible identity', () => {
  const f = fixture(); for (const file of [f.committed, f.staged]) fs.writeFileSync(file, JSON.stringify(saved)); f.auth.restore(); fs.writeFileSync(f.staged, 'interrupted'); f.auth.signOut();
  expect(fs.existsSync(f.committed)).toBe(false); expect(fs.existsSync(f.staged)).toBe(false); expect(f.auth.session).toBeNull(); expect(f.auth.remembered).toBe(false);
});
it('session-removal failure still clears memory, notifies observers and reports the residual saved-file problem', () => {
  const changed = vi.fn(), f = fixture(changed); fs.writeFileSync(f.committed, JSON.stringify(saved)); fs.writeFileSync(f.staged, 'interrupted'); f.auth.restore(); fs.writeFileSync(f.staged, 'interrupted');
  const original = fs.rmSync; vi.spyOn(fs, 'rmSync').mockImplementation((file, options) => { if (file === f.committed) throw Error('synthetic denied path must not escape'); original(file, options); });
  expect(() => f.auth.signOut()).toThrow('saved sign-in'); expect(f.auth.session).toBeNull(); expect(f.auth.remembered).toBe(false); expect(changed).toHaveBeenCalledTimes(1); expect(fs.existsSync(f.staged)).toBe(false);
  vi.restoreAllMocks(); const fresh = new AuthService(config, f.root, secure, async () => {}); fresh.restore(); expect(fresh.session).toBeNull();
  fresh.signOut(); expect(fs.existsSync(f.committed)).toBe(false); expect(fs.existsSync(`${f.committed}.signed-out`)).toBe(false);
});
function provider() {
  vi.stubGlobal('fetch', vi.fn(async (address: string) => new Response(JSON.stringify(address.includes(':lookup') ? { users: [{ ...saved.session, localId: 'fixture', emailVerified: true, providerUserInfo: [{ providerId: 'password' }] }] } : { localId: 'fixture', idToken: 'synthetic-id-token', refreshToken: 'synthetic-new-refresh', expiresIn: '3600' }))));
}
it('failed atomic replacement preserves the committed session, removes staging and hides filesystem errors', async () => {
  const f = fixture(), bytes = JSON.stringify(saved); fs.writeFileSync(f.committed, bytes); provider();
  vi.spyOn(fs, 'renameSync').mockImplementation(() => { throw Error('private filesystem location'); });
  await expect(f.auth.signIn('fixture@example.test', 'existing-password')).rejects.toMatchObject({ code: 'SESSION_STORAGE_FAILED' });
  expect(f.auth.remembered).toBe(false); expect(fs.readFileSync(f.committed, 'utf8')).toBe(bytes); expect(fs.existsSync(f.staged)).toBe(false);
});
it('successful explicit sign-in replaces saved identity and removes the prior sign-out marker', async () => {
  const f = fixture(); fs.writeFileSync(`${f.committed}.signed-out`, '1'); provider();
  await f.auth.signIn('fixture@example.test', 'existing-password');
  expect(f.auth.remembered).toBe(true); expect(fs.existsSync(`${f.committed}.signed-out`)).toBe(false);
  const fresh = new AuthService(config, f.root, secure, async () => {}); fresh.restore(); expect(fresh.session?.uid).toBe('fixture');
});
