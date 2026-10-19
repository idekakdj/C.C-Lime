import { afterEach, expect, it } from 'vitest';
import net from 'node:net';
import { once } from 'node:events';
import { oauthCallback } from '../../src/main/oauth-callback';
const attempts: ReturnType<typeof oauthCallback>[] = [], sockets: net.Socket[] = [];
const state = 'synthetic-random-state-for-owned-loopback';
async function fixture(timeout = 3000, idle = 1000) {
  let opened!: (url: string) => void;
  const address = new Promise<string>(resolve => { opened = resolve; });
  const callback = oauthCallback(state, async url => opened(url), timeout, idle); attempts.push(callback);
  const outcome = callback.result.then(value => ({ value, error: null }), error => ({ value: null, error }));
  return { callback, outcome, address: await address };
}
afterEach(() => { for (const attempt of attempts.splice(0)) attempt.cancel(); for (const socket of sockets.splice(0)) socket.destroy(); });
function url(address: string, query: string) { return `${address}?state=${state}&${query}`; }
async function raw(address: string, target: string, host?: string) {
  const parsed = new URL(address), socket = net.connect(Number(parsed.port), '127.0.0.1'); sockets.push(socket);
  await once(socket, 'connect');
  let text = ''; socket.setEncoding('utf8'); socket.on('data', value => { text += value; });
  socket.write(`GET ${target} HTTP/1.1\r\nHost: ${host ?? parsed.host}\r\nConnection: close\r\n\r\n`);
  await once(socket, 'close'); return text;
}
it('malformed absolute target and foreign host are rejected without terminating a legitimate attempt', async () => {
  const f = await fixture();
  expect(await raw(f.address, 'http://[')).toContain('400 Bad Request');
  expect(await raw(f.address, '/oauth/callback', 'foreign.example.test')).toContain('400 Bad Request');
  const response = await fetch(url(f.address, 'code=synthetic-code')); expect(response.status).toBe(200); expect(await response.text()).toContain('return to C.C. Lime');
  expect((await f.outcome).value).toEqual({ code: 'synthetic-code', redirect: f.address }); await expect(fetch(f.address)).rejects.toThrow();
});
it('duplicate parameters and ambiguous code/error do not consume a valid callback', async () => {
  const f = await fixture();
  for (const query of [`state=${state}&code=x`, 'code=x&code=y', 'error=cancel&error=again', 'code=x&error=cancel']) expect((await fetch(url(f.address, query))).status).toBe(400);
  expect((await fetch(url(f.address, 'error=access_denied'))).status).toBe(200); expect((await f.outcome).error.message).toContain('canceled');
});
it('wrong state, route and method preserve the pending attempt and do not reflect callback values', async () => {
  const f = await fixture();
  const response = await fetch(`${f.address}?state=private-forged-value&code=secret-code-value`); expect(response.status).toBe(400); expect(await response.text()).not.toMatch(/private-forged|secret-code/);
  expect(response.headers.get('cache-control')).toBe('no-store'); expect(response.headers.get('referrer-policy')).toBe('no-referrer');
  expect((await fetch(new URL('/other', f.address))).status).toBe(404); expect((await fetch(url(f.address, 'code=x'), { method: 'POST' })).status).toBe(404);
  f.callback.cancel(); expect((await f.outcome).error.message).toContain('canceled');
});
it('oversized headers are refused while the listener remains usable', async () => {
  const f = await fixture(); expect(await raw(f.address, '/oauth/callback', 'x'.repeat(9000))).toContain('400 Bad Request');
  expect((await fetch(url(f.address, 'error=access_denied'))).status).toBe(200); await f.outcome;
});
it('cancellation closes unfinished active sockets as well as the listener', async () => {
  const f = await fixture(), parsed = new URL(f.address), socket = net.connect(Number(parsed.port), '127.0.0.1'); sockets.push(socket); await once(socket, 'connect');
  socket.on('error', error => expect((error as NodeJS.ErrnoException).code).toBe('ECONNRESET'));
  socket.write('GET /oauth/callback HTTP/1.1\r\n'); const closed = new Promise<void>(resolve => socket.once('close', () => resolve())); f.callback.cancel(); await closed;
  expect((await f.outcome).error.message).toContain('canceled'); await expect(fetch(f.address)).rejects.toThrow();
});
it('idle partial requests time out without consuming a valid attempt', async () => {
  const f = await fixture(3000, 100), parsed = new URL(f.address), socket = net.connect(Number(parsed.port), '127.0.0.1'); sockets.push(socket); await once(socket, 'connect');
  socket.write('GET /oauth/callback HTTP/1.1\r\n'); await once(socket, 'close');
  expect((await fetch(url(f.address, 'error=access_denied'))).status).toBe(200); await f.outcome;
});
it('the attempt deadline and failed browser launch retire the listener', async () => {
  const f = await fixture(100); expect((await f.outcome).error.message).toContain('timed out'); await expect(fetch(f.address)).rejects.toThrow();
  const callback = oauthCallback(state, async () => { throw Error('synthetic private path'); }); attempts.push(callback);
  await expect(callback.result).rejects.toThrow('Could not open Google sign-in');
});
it('immediate cancellation cannot leave a subsequently listening socket behind', async () => {
  let opened = false; const callback = oauthCallback(state, async () => { opened = true; }); attempts.push(callback);
  const result = callback.result.catch(error => error); callback.cancel(); expect((await result).message).toContain('canceled');
  await new Promise(resolve => setTimeout(resolve, 20)); expect(opened).toBe(false);
});
it('a delayed callback cannot replace the selected authorization code or reopen the retired listener', async () => {
  const f = await fixture(); const selected = await fetch(url(f.address, 'code=first-owned-code'));
  expect(selected.status).toBe(200); expect((await f.outcome).value?.code).toBe('first-owned-code');
  await expect(fetch(url(f.address, 'code=delayed-owned-code'))).rejects.toThrow(); expect((await f.outcome).value?.code).toBe('first-owned-code');
});
it('excess connections are dropped while the accepted bounded set remains alive until cancellation', async () => {
  const f = await fixture(10000, 5000), parsed = new URL(f.address), accepted: net.Socket[] = [];
  for (let i = 0; i < 16; i++) {
    const socket = net.connect(Number(parsed.port), '127.0.0.1'); sockets.push(socket); accepted.push(socket); await once(socket, 'connect');
    socket.on('error', error => expect((error as NodeJS.ErrnoException).code).toBe('ECONNRESET')); socket.write('GET /oauth/callback HTTP/1.1\r\n');
  }
  const excess = net.connect(Number(parsed.port), '127.0.0.1'); sockets.push(excess);
  excess.on('error', error => expect((error as NodeJS.ErrnoException).code).toBe('ECONNRESET'));
  await new Promise<void>(resolve => excess.once('close', () => resolve())); expect(accepted.every(socket => !socket.destroyed)).toBe(true);
  const closed = accepted.map(socket => new Promise<void>(resolve => socket.once('close', () => resolve()))); f.callback.cancel(); await Promise.all(closed);
  expect((await f.outcome).error.message).toContain('canceled');
});
