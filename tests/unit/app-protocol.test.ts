import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { appProtocol, isAppDocument } from '../../src/main/app-protocol';
let root: string;
beforeEach(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), 'cc-lime-protocol-')); await fs.writeFile(path.join(root, 'index.html'), 'calendar'); await fs.writeFile(path.join(root, 'app.js'), 'script'); });
afterEach(async () => { if (path.dirname(root) === path.resolve(os.tmpdir()) && path.basename(root).startsWith('cc-lime-protocol-')) await fs.rm(root, { recursive: true, force: true }); });
it('serves the root/assets and HEAD without losing status or headers', async () => {
  const handler = appProtocol(root, async () => new Response('calendar', { headers: { 'Content-Type': 'text/html' } }));
  expect(await (await handler({ url: 'cclime://app/', method: 'GET' })).text()).toBe('calendar');
  const response = await handler({ url: 'cclime://app/app.js', method: 'HEAD' });
  expect(response.status).toBe(200); expect(await response.text()).toBe(''); expect(response.headers.get('content-type')).toBe('text/html');
});
it('HTML GET and HEAD deny framing without preventing ordinary asset fetches', async () => {
  const handler = appProtocol(root, async () => new Response('calendar', { headers: { 'Content-Type': 'text/html' } }));
  for (const method of ['GET', 'HEAD']) {
    const response = await handler({ url: 'cclime://app/index.html', method }); expect(response.status).toBe(200);
    expect(response.headers.get('content-security-policy')).toContain("frame-ancestors 'none'"); expect(response.headers.get('content-security-policy')).toContain("frame-src 'none'");
  }
  expect((await handler({ url: 'cclime://app/app.js', method: 'GET' })).headers.has('content-security-policy')).toBe(false);
});
it.each(['cclime://app/missing', 'cclime://app/missing.js', 'cclime://else/index.html', 'cclime://user@app/index.html', 'cclime://app:80/index.html', 'cclime://app/%ZZ', 'cclime://app/%2e%2e%2fprivate.html', 'cclime://app/%5c..%5cprivate.html', 'cclime://app/C%3a/private.html', 'cclime://app/%00.html'])('returns an unreflected secure 404 for %s', async url => {
  const fetcher = vi.fn(); const response = await appProtocol(root, fetcher)({ url: `${url}?secret=do-not-reflect`, method: 'GET' });
  expect(response.status).toBe(404); expect(fetcher).not.toHaveBeenCalled(); const body = await response.text();
  expect(body).toContain('Page not found'); expect(body).toContain('Return to calendar'); expect(body).not.toContain('do-not-reflect'); expect(body).not.toContain(root);
  expect(response.headers.get('content-security-policy')).toContain("default-src 'none'"); expect(response.headers.get('cache-control')).toBe('no-store'); expect(response.headers.get('x-content-type-options')).toBe('nosniff');
});
it('contains asynchronous file failures, directories and unsupported methods', async () => {
  const handler = appProtocol(root, async () => { throw new Error('private filesystem details'); });
  expect((await handler({ url: 'cclime://app/', method: 'GET' })).status).toBe(404);
  await fs.mkdir(path.join(root, 'directory.html')); expect((await handler({ url: 'cclime://app/directory.html', method: 'GET' })).status).toBe(404);
  const method = await handler({ url: 'cclime://app/', method: 'POST' }); expect(method.status).toBe(405); expect(method.headers.get('allow')).toBe('GET, HEAD');
  const head = await handler({ url: 'cclime://app/missing', method: 'HEAD' }); expect(head.status).toBe(404); expect(await head.text()).toBe('');
});
it('denies a directory junction escaping the renderer root', async () => {
  await fs.mkdir(path.join(root, 'renderer')); await fs.symlink(root, path.join(root, 'renderer', 'escape'), process.platform === 'win32' ? 'junction' : 'dir');
  const fetcher = vi.fn(); const response = await appProtocol(path.join(root, 'renderer'), fetcher)({ url: 'cclime://app/escape/index.html', method: 'GET' });
  expect(response.status).toBe(404); expect(fetcher).not.toHaveBeenCalled();
});
it('trusts only the canonical app document for recovery navigation and IPC', () => {
  for (const url of ['cclime://app/', 'cclime://app/index.html', 'cclime://app/index.html#day']) expect(isAppDocument(url)).toBe(true);
  for (const url of ['cclime://app/404', 'cclime://app/index.html?x=y', 'cclime://app.evil/index.html', 'https://app/index.html', 'cclime://user@app/index.html', 'not a URL']) expect(isAppDocument(url)).toBe(false);
});
