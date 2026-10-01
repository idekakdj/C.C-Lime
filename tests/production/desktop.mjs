import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { extractFile } from '@electron/asar';
import { fuseNames, fuseSentinel, readElectronFuses, hardeningGaps } from '../../scripts/native-package-policy.mjs';
import { inspectAsarIntegrity } from '../../scripts/asar-integrity-policy.mjs';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function bounded(operation, milliseconds, message) {
  let timer;
  try { return await Promise.race([operation, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), milliseconds); })]); }
  finally { clearTimeout(timer); }
}

export async function acceptanceCopy(disableInspection = true, allFuses = false) {
  assert.equal(typeof disableInspection, 'boolean');
  assert.equal(typeof allFuses, 'boolean');
  assert.ok(!allFuses || disableInspection, 'Combined hardening cannot enable Node inspection.');
  const base = path.resolve('test-results/production-acceptance');
  await fs.mkdir(base, { recursive: true });
  const root = path.join(base, randomUUID()), bundle = path.join(root, 'package');
  assert.equal(path.dirname(root), base);
  await fs.mkdir(root);
  await fs.cp(path.resolve('out/C.C. Lime-win32-x64'), bundle, { recursive: true, errorOnExist: true, force: false });
  const executable = path.join(bundle, 'cc-lime.exe'), bytes = await fs.readFile(executable), before = readElectronFuses(bytes);
  assert.equal(before.values.nodeCliInspect, true, 'This migration fixture expects the unchanged development package.');
  if (disableInspection) {
    const slot = bytes.indexOf(fuseSentinel) + fuseSentinel.length + 2 + 3;
    assert.equal(bytes[slot], 0x31); bytes[slot] = 0x30;
    assert.deepEqual(readElectronFuses(bytes).values, { ...before.values, nodeCliInspect: false });
    await fs.writeFile(executable, bytes);
  }
  const archive = path.join(bundle, 'resources/app.asar');
  if (allFuses) {
    const targets = { runAsNode: false, cookieEncryption: true, nodeOptions: false, nodeCliInspect: false,
      embeddedAsarIntegrityValidation: true, onlyLoadAppFromAsar: true, grantFileProtocolExtraPrivileges: false };
    for (const [name, value] of Object.entries(targets)) {
      const slot = bytes.indexOf(fuseSentinel) + fuseSentinel.length + 2 + fuseNames.indexOf(name);
      assert.ok([0x30, 0x31].includes(bytes[slot])); bytes[slot] = value ? 0x31 : 0x30;
    }
    assert.deepEqual(readElectronFuses(bytes).values, { ...before.values, ...targets });
    assert.deepEqual(hardeningGaps(readElectronFuses(bytes)), []);
    inspectAsarIntegrity(bytes, archive); await fs.writeFile(executable, bytes);
  }
  const manifest = JSON.parse(extractFile(archive, 'package.json').toString('utf8'));
  const packageSha256 = createHash('sha256').update(await fs.readFile(archive)).digest('hex');
  const policy = { mode: allFuses ? 'all-seven' : disableInspection ? 'inspection-only' : 'unchanged',
    executableSha256: createHash('sha256').update(bytes).digest('hex'), archiveSha256: packageSha256,
    fuses: readElectronFuses(bytes).values, staticHeaderMatches: inspectAsarIntegrity(bytes, archive).headerMatches };
  await fs.writeFile(path.join(root, 'copy-policy.json'), JSON.stringify(policy, null, 2));
  return { root, executable, version: manifest.version, packageSha256, policy };
}

export async function rendererCopy() {
  const mode = process.env.CC_LIME_ACCEPTANCE_FUSES ?? 'inspection-only';
  assert.ok(['inspection-only', 'all-seven'].includes(mode), 'Unknown acceptance fuse mode.');
  return acceptanceCopy(true, mode === 'all-seven');
}

export async function startDesktop(copy, profile, inspectPort, probe = {}) {
  assert.equal(path.dirname(profile), copy.root, 'Synthetic profile must stay in the owned fixture root.');
  if (copy.policy.mode === 'all-seven') {
    const bytes = await fs.readFile(copy.executable);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), copy.policy.executableSha256);
    assert.deepEqual(hardeningGaps(readElectronFuses(bytes)), []);
    inspectAsarIntegrity(bytes, path.join(path.dirname(copy.executable), 'resources/app.asar'));
  }
  if (inspectPort !== undefined) assert.ok(Number.isInteger(inspectPort) && inspectPort > 1024 && inspectPort < 65536);
  await fs.mkdir(profile, { recursive: true });
  // Own a non-tray fixture from its first launch; do not rewrite settings just to close every child.
  const settings = path.join(profile, 'device.json');
  try { await fs.writeFile(settings, JSON.stringify({ closeToTray: false }), { flag: 'wx' }); }
  catch (error) { if (error.code !== 'EEXIST') throw error; assert.ok((await fs.lstat(settings)).isFile()); }
  await fs.writeFile(path.join(profile, 'quit-explained'), '1');
  await fs.writeFile(path.join(profile, 'tray-explained'), '1');
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE; delete env.NODE_OPTIONS; delete env.NODE_EXTRA_CA_CERTS; delete env.ELECTRON_NO_ASAR;
  if (probe.nodeScript !== undefined) {
    assert.equal(path.dirname(probe.nodeScript), copy.root, 'Probe script must stay in the owned fixture root.');
    assert.ok((await fs.lstat(probe.nodeScript)).isFile());
    env.ELECTRON_RUN_AS_NODE = '1';
  }
  const child = spawn(copy.executable, [...(probe.nodeScript === undefined ? [] : [probe.nodeScript]), `--cc-lime-test-profile=${profile}`, '--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1', '--no-error-dialogs', ...(inspectPort === undefined ? [] : [`--inspect=127.0.0.1:${inspectPort}`])], {
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
      nodeInspectorAnnounced: () => /Debugger listening on ws:\/\/127\.0\.0\.1:\d+\//.test(stderr),
      async close() {
        if (closed) return;
        closed = true;
        try {
          const state = await page.evaluate(() => window.lime.call('snapshot'));
          if (state.device.closeToTray) await page.evaluate(() => window.lime.call('device', { closeToTray: false }));
          const session = await browser.newBrowserCDPSession();
          try { await bounded(Promise.race([session.send('Browser.close'), exit]), 3000, 'Close request timed out.'); } catch {}
          const result = await bounded(exit, 10000, 'Application did not exit normally.');
          assert.equal(result.code, 0, 'Normal application exit is required.'); assert.equal(result.signal, null);
        } finally { await cleanup(); }
      },
    };
  } catch (error) { await cleanup(); throw error; }
}
