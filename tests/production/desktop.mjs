import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { extractFile } from '@electron/asar';
import { fuseSentinel, readElectronFuses } from '../../scripts/native-package-policy.mjs';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function bounded(operation, milliseconds, message) {
  let timer;
  try { return await Promise.race([operation, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), milliseconds); })]); }
  finally { clearTimeout(timer); }
}

export async function acceptanceCopy() {
  const base = path.resolve('test-results/production-acceptance');
  await fs.mkdir(base, { recursive: true });
  const root = path.join(base, randomUUID()), bundle = path.join(root, 'package');
  assert.equal(path.dirname(root), base);
  await fs.mkdir(root);
  await fs.cp(path.resolve('out/C.C. Lime-win32-x64'), bundle, { recursive: true, errorOnExist: true, force: false });
  const executable = path.join(bundle, 'cc-lime.exe'), bytes = await fs.readFile(executable), before = readElectronFuses(bytes);
  assert.equal(before.values.nodeCliInspect, true, 'This migration fixture expects the unchanged development package.');
  const slot = bytes.indexOf(fuseSentinel) + fuseSentinel.length + 2 + 3;
  assert.equal(bytes[slot], 0x31); bytes[slot] = 0x30;
  assert.deepEqual(readElectronFuses(bytes).values, { ...before.values, nodeCliInspect: false });
  await fs.writeFile(executable, bytes);
  const manifest = JSON.parse(extractFile(path.join(bundle, 'resources/app.asar'), 'package.json').toString('utf8'));
  return { root, executable, version: manifest.version };
}

export async function startDesktop(copy, profile) {
  assert.equal(path.dirname(profile), copy.root, 'Synthetic profile must stay in the owned fixture root.');
  await fs.mkdir(profile, { recursive: true });
  await fs.writeFile(path.join(profile, 'quit-explained'), '1');
  await fs.writeFile(path.join(profile, 'tray-explained'), '1');
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE; delete env.NODE_OPTIONS;
  const child = spawn(copy.executable, [`--cc-lime-test-profile=${profile}`, '--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1', '--no-error-dialogs'], {
    cwd: path.dirname(copy.executable), env, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'],
  });
  let stderr = '', outcome, browser, page, closed = false;
  const exit = new Promise(resolve => {
    child.once('exit', (code, signal) => { outcome = { code, signal }; resolve(outcome); });
    child.once('error', () => { outcome = { spawnFailed: true }; resolve(outcome); });
  });
  child.stderr.on('data', bytes => { if (stderr.length < 65536) stderr += bytes.toString().slice(0, 65536 - stderr.length); });
  async function cleanup() {
    if (!outcome) { child.kill(); await bounded(exit, 5000, 'Owned process cleanup timed out.'); }
    if (browser) await bounded(browser.close().catch(() => {}), 3000, 'Transport cleanup timed out.');
  }
  try {
    let endpoint;
    for (let i = 0; i < 150; i++) {
      endpoint = stderr.match(/DevTools listening on (ws:\/\/127\.0\.0\.1:\d+\/devtools\/browser\/[^\s]+)/)?.[1];
      if (endpoint || outcome) break;
      await sleep(100);
    }
    assert.ok(endpoint, 'Owned application did not expose the loopback Chromium endpoint.');
    assert.equal(new URL(endpoint).hostname, '127.0.0.1');
    browser = await chromium.connectOverCDP(endpoint, { timeout: 10000 });
    for (let i = 0; i < 100; i++) {
      page = browser.contexts()[0].pages().find(p => p.url().startsWith('cclime://app/'));
      if (page) break;
      await sleep(100);
    }
    assert.ok(page, 'Application renderer was not available.');
    page.setDefaultTimeout(10000);
    await page.getByRole('button', { name: /Explore a local calendar/ }).click();
    await page.getByRole('heading', { name: 'Your calendar', exact: true }).waitFor();
    const snapshot = await page.evaluate(() => window.lime.call('snapshot'));
    assert.equal(snapshot.localMode, true); assert.equal(snapshot.configured, false, 'No account configuration is allowed in this fixture.');
    if (!snapshot.device.onboardingDone) {
      await page.getByRole('button', { name: 'Use defaults' }).click();
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
    }
    return {
      page,
      async close() {
        if (closed) return;
        closed = true;
        try {
          await page.evaluate(() => window.lime.call('device', { closeToTray: false }));
          const session = await browser.newBrowserCDPSession();
          try { await bounded(Promise.race([session.send('Browser.close'), exit]), 3000, 'Close request timed out.'); } catch {}
          const result = await bounded(exit, 10000, 'Application did not exit normally.');
          assert.equal(result.code, 0, 'Normal application exit is required.'); assert.equal(result.signal, null);
        } finally { await cleanup(); }
      },
    };
  } catch (error) { await cleanup(); throw error; }
}
