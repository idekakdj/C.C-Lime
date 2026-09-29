import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { zipFixture } from './zip-fixture.mjs';

const notice = Buffer.from('<html>Fixture notices\r\nExact original bytes.</html>');
const member = 'lib/net45/LICENSES.chromium.html';
const metadata = version => ({ name: 'cc_lime.nuspec', data: `<package xmlns="http://schemas.microsoft.com/packaging/2010/07/nuspec.xsd"><metadata><version>${version}</version></metadata></package>` });
function verify(entries) {
  const root = path.resolve('test-results/installer-notice-fixtures', randomUUID()); fs.mkdirSync(root, { recursive: true });
  const archive = path.join(root, 'fixture.nupkg'), source = path.join(root, 'LICENSES.chromium.html'), report = path.join(root, 'summary.json');
  fs.writeFileSync(archive, Buffer.isBuffer(entries) ? entries : zipFixture(entries)); fs.writeFileSync(source, notice);
  fs.writeFileSync(report, '{"stale":true}');
  const result = spawnSync('pwsh.exe', ['-NoProfile', '-NonInteractive', '-File', path.resolve('scripts/check-installer-notices.ps1'), '-Package', archive, '-Notice', source, '-Version', '1.2.3', '-Report', report], { encoding: 'utf8', windowsHide: true, timeout: 30000 });
  assert.equal(result.error, undefined);
  return { ...result, report, root };
}
test('actual installer verifier checks exact notice bytes and namespaced metadata without extracting files', () => {
  const result = verify([metadata('1.2.3'), { name: member, data: notice }, { name: '../must-not-be-extracted', data: 'ignored' }]);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(fs.readFileSync(result.report, 'utf8'));
  assert.equal(report.exactNoticeMatch, true); assert.equal(report.metadataVersionMatch, true);
  assert.equal(report.noticeSha256, createHash('sha256').update(notice).digest('hex'));
  assert.deepEqual(fs.readdirSync(result.root).sort(), ['LICENSES.chromium.html', 'fixture.nupkg', 'summary.json']);
  assert.equal(fs.existsSync(path.resolve(result.root, '../must-not-be-extracted')), false);
});
for (const [name, entries] of [
  ['missing notices', [metadata('1.2.3')]],
  ['duplicate case-variant notice paths', [metadata('1.2.3'), { name: member, data: notice }, { name: member.toUpperCase(), data: notice }]],
  ['same-sized changed notice bytes', [metadata('1.2.3'), { name: member, data: Buffer.alloc(notice.length, 65) }]],
  ['incorrect version', [metadata('9.9.9'), { name: member, data: notice }]],
  ['ambiguous metadata', [metadata('1.2.3'), { ...metadata('1.2.3'), name: 'second.nuspec' }, { name: member, data: notice }]],
  ['malformed archive', Buffer.from('not a ZIP archive')],
]) test(`installer verifier rejects ${name} and removes stale success evidence`, () => {
  const result = verify(entries); assert.notEqual(result.status, 0); assert.equal(fs.existsSync(result.report), false);
});
