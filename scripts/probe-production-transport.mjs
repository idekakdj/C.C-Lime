import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { extractFile } from '@electron/asar';
import { fuseSentinel, readElectronFuses } from './native-package-policy.mjs';

const base = path.resolve('test-results/fuse-transport');
await fs.mkdir(base, { recursive: true });
const root = path.join(base, randomUUID()), copy = path.join(root, 'package'), profile = path.join(root, 'profile');
assert.equal(path.dirname(root), base);
await fs.mkdir(root); await fs.mkdir(profile);
await fs.cp(path.resolve('out/C.C. Lime-win32-x64'), copy, { recursive: true, errorOnExist: true, force: false });
await fs.writeFile(path.join(profile, 'quit-explained'), '1');
await fs.writeFile(path.join(profile, 'tray-explained'), '1');
const executable = path.join(copy, 'cc-lime.exe'), bytes = await fs.readFile(executable);
const before = readElectronFuses(bytes);
assert.equal(before.values.nodeCliInspect, true);
const index = bytes.indexOf(fuseSentinel) + fuseSentinel.length + 2 + 3;
assert.equal(bytes[index], 0x31); bytes[index] = 0x30;
const after = readElectronFuses(bytes);
assert.deepEqual(after.values, { ...before.values, nodeCliInspect: false });
await fs.writeFile(executable, bytes);
const manifest = JSON.parse(extractFile(path.join(copy, 'resources/app.asar'), 'package.json').toString('utf8'));
assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
const report = { date: new Date().toISOString(), version: manifest.version,
  scope: 'Disposable-copy acceptance-transport feasibility only; no installed/retained binary mutation, no production hardening or full regression claim.',
  copySha256: createHash('sha256').update(bytes).digest('hex'), nodeCliInspect: after.values.nodeCliInspect,
  rendererTransportConnected: false, calendarRendered: false, normalExit: false, forcedOwnedCleanup: false };
const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE; delete env.NODE_OPTIONS;
const child = spawn(executable, [`--cc-lime-test-profile=${profile}`, '--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1', '--no-error-dialogs'], { cwd: copy, env, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
let stderr = '', exited = false, browser, endpoint;
const exit = new Promise(resolve => { child.once('exit', (code, signal) => { exited = true; report.exitCode = code; report.exitSignal = signal; resolve(); }); child.once('error', () => { exited = true; report.spawnFailed = true; resolve(); }); });
child.stderr.on('data', bytes => { if (stderr.length < 65536) stderr += bytes.toString(); });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
try {
  for (let attempt = 0; attempt < 150; attempt++) {
    endpoint = stderr.match(/DevTools listening on (ws:\/\/127\.0\.0\.1:\d+\/devtools\/browser\/[^\s]+)/)?.[1];
    if (endpoint || exited) break;
    await delay(100);
  }
  if (!endpoint) throw new Error('Chromium loopback endpoint was not available.');
  assert.equal(new URL(endpoint).hostname, '127.0.0.1');
  browser = await chromium.connectOverCDP(endpoint, { timeout: 10000 });
  report.rendererTransportConnected = true;
  const context = browser.contexts()[0];
  let page;
  for (let attempt = 0; attempt < 100; attempt++) {
    page = context.pages().find(p => p.url().startsWith('cclime://app/'));
    if (page) break;
    await delay(100);
  }
  if (!page) throw new Error('Calendar renderer is not exposed through the existing transport.');
  await page.getByRole('button', { name: /Explore a local calendar/ }).click({ timeout: 10000 });
  await page.getByRole('heading', { name: 'Your calendar', exact: true }).waitFor({ timeout: 10000 });
  report.calendarRendered = true;
  await page.evaluate(() => window.lime.call('device', { closeToTray: false }));
  const connection = await browser.newBrowserCDPSession();
  try { await Promise.race([connection.send('Browser.close'), exit, delay(3000).then(() => { throw new Error('Browser close command did not settle.'); })]); } catch { report.browserCloseUnavailable = true; }
  await Promise.race([exit, delay(5000)]);
  report.normalExit = exited && report.exitCode === 0;
} catch (error) {
  report.limitation = error.message;
} finally {
  if (browser) await Promise.race([browser.close().catch(() => {}), delay(3000)]);
  if (!exited) { report.forcedOwnedCleanup = true; child.kill(); await Promise.race([exit, delay(5000)]); }
  await fs.writeFile(path.join(root, 'summary.json'), JSON.stringify(report, null, 2));
  await fs.writeFile(path.resolve('test-results/fuse-transport-feasibility-' + manifest.version + '.json'), JSON.stringify(report, null, 2));
}
console.log(JSON.stringify(report, null, 2));

if (!report.rendererTransportConnected || !report.calendarRendered || !report.normalExit || report.forcedOwnedCleanup) process.exitCode = 1;
