import { test, expect } from '@playwright/test';
import net from 'node:net';
import fs from 'node:fs/promises';
import path from 'node:path';
import { acceptanceCopy, startDesktop } from './desktop.mjs';

async function availablePort(): Promise<number> {
  const server = net.createServer();
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected a loopback TCP port.');
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return address.port;
}

test('paired control proves disabled Node CLI inspection refuses the listening endpoint', async ({}, testInfo) => {
  const control = await acceptanceCopy(false), hardened = await acceptanceCopy(), controlPort = await availablePort();
  const first = await startDesktop(control, path.join(control.root, 'inspector-control'), controlPort);
  try {
    expect(first.nodeInspectorAnnounced()).toBe(true);
    const response = await fetch(`http://127.0.0.1:${controlPort}/json/list`, { signal: AbortSignal.timeout(3000) });
    expect(response.ok).toBe(true);
    const targets = await response.json();
    expect(targets.some((target: { type: string }) => target.type === 'node')).toBe(true);
  } finally { await first.close(); }
  const blockedPort = await availablePort(), second = await startDesktop(hardened, path.join(hardened.root, 'inspector-disabled'), blockedPort);
  try {
    expect(second.nodeInspectorAnnounced()).toBe(false);
    // A timeout is not accepted as refusal. Require the OS's connection-refused result.
    for (let i = 0; i < 3; i++) {
      let refused = false;
      try { await fetch(`http://127.0.0.1:${blockedPort}/json/list`, { signal: AbortSignal.timeout(1000) }); }
      catch (error) { refused = (error as Error & { cause?: { code?: string } }).cause?.code === 'ECONNREFUSED'; }
      expect(refused).toBe(true);
    }
  } finally { await second.close(); }
  await fs.writeFile(testInfo.outputPath('summary.json'), JSON.stringify({ version: hardened.version, controlNodeTargetObserved: true,
    disabledInspectorAnnouncementAbsent: true, disabledInspectorPortRefused: true, normalExit: true, nodeCliInspect: false,
    scope: 'Paired disposable control; Node CLI inspection only. Other fuses remain unchanged.' }, null, 2));
});
