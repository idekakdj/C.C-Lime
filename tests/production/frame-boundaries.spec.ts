import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { rendererCopy, startDesktop } from './desktop.mjs';
import type { Snapshot } from '../../src/shared/model';

test('canonical HTML remains readable while embedded app documents are blocked and service-worker registration is unavailable', async ({}, info) => {
  const copy = await rendererCopy(), desktop = await startDesktop(copy, path.join(copy.root, 'frame-boundary-profile'));
  try {
    const page = desktop.page;
    expect((await page.evaluate(() => window.lime.call<Snapshot>('snapshot'))).localMode).toBe(true);
    const response = await page.evaluate(async () => { const r = await fetch('cclime://app/index.html'); return { status: r.status, csp: r.headers.get('content-security-policy'), text: await r.text() }; });
    expect(response.status).toBe(200); expect(response.text).toContain('id="root"'); expect(response.csp).toContain("frame-ancestors 'none'");
    await page.evaluate(() => {
      (window as any).ownedFrameViolations = [];
      document.addEventListener('securitypolicyviolation', event => { (window as any).ownedFrameViolations.push({ directive: event.effectiveDirective, blocked: event.blockedURI }); });
      const iframe = document.createElement('iframe'); iframe.id = 'owned-frame'; iframe.src = 'cclime://app/index.html'; document.body.append(iframe);
    });
    await expect.poll(() => page.evaluate(() => (window as any).ownedFrameViolations.some((v: any) => v.directive === 'frame-src' && ['cclime', 'cclime://app/index.html'].includes(v.blocked)))).toBe(true);
    expect(await page.locator('#owned-frame').count()).toBe(1);
    const child = page.frames().find(frame => frame !== page.mainFrame()); expect(child).toBeDefined();
    expect(await child!.evaluate(() => ({ bridge: typeof (window as any).lime, node: typeof (window as any).require, process: typeof (window as any).process, app: !!document.querySelector('#root') }))).toEqual({ bridge: 'undefined', node: 'undefined', process: 'undefined', app: false });
    const worker = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return { available: false, registered: false };
      try { await navigator.serviceWorker.register('cclime://app/assets/owned-security-worker.js'); return { available: true, registered: true }; }
      catch (error) { return { available: true, registered: false, error: (error as Error).message }; }
    });
    expect(worker.registered).toBe(false);
    if (worker.available) expect(worker.error).toMatch(/not supported|not allowed|unsupported|scheme/i);
    // The absent-script URL is not accepted as a positive worker control; an owned
    // protocol fixture separately establishes valid registration and denial.
    await page.locator('#owned-frame').evaluate(element => element.remove());
    expect((await page.evaluate(() => window.lime.call<Snapshot>('snapshot'))).localMode).toBe(true);
  } finally { await desktop.close(); }
  await fs.writeFile(info.outputPath('summary.json'), JSON.stringify({ version: copy.version, packageSha256: copy.packageSha256, fixturePolicy: copy.policy,
    canonicalHtmlFetchSucceeded: true, cspFrameDenialObserved: true, blockedChildHasNoBridgeOrNode: true, serviceWorkerRegistrationUnavailable: true, mainBridgePreserved: true,
    nodeCliInspect: false, normalExit: true, scope: 'Actual packaged app document/CSP and unavailable registration observation. Valid-worker positive control is measured separately; no arbitrary remote document or browser exploit claim.' }, null, 2));
});
