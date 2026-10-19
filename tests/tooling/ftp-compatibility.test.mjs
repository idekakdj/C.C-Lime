import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

test('Firebase PAC retrieval resolves the patched FTP package at runtime', () => {
  const require = createRequire(import.meta.url);
  const cli = createRequire(require.resolve('firebase-tools'));
  const proxy = createRequire(cli.resolve('proxy-agent'));
  const pac = createRequire(proxy.resolve('pac-proxy-agent'));
  const uri = createRequire(pac.resolve('get-uri'));
  assert.equal(uri('basic-ftp/package.json').version, '6.2.1');
});

for (const scenario of ['download', 'fallback', 'malformed', 'cache', 'missing']) {
  test(`patched FTP supports ${scenario} through bounded loopback runtime acceptance`, { timeout: 12000 }, async () => {
    const { stdout, stderr } = await promisify(execFile)(process.execPath,
      [fileURLToPath(new URL('./ftp-fixture.mjs', import.meta.url)), scenario],
      { timeout: 8000, maxBuffer: 128 * 1024, windowsHide: true });
    assert.equal(stderr, '');
    assert.deepEqual(JSON.parse(stdout), { scenario, closed: true });
  });
}
