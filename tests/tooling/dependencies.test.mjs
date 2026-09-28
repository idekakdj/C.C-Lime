import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import { assessAudit } from '../../scripts/dependency-policy.mjs';

function report(severity) {
  const vulnerabilities = severity ? { fixture: { severity } } : {};
  const counts = { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: severity ? 1 : 0 };
  if (severity) counts[severity]++;
  return { auditReportVersion: 2, vulnerabilities, metadata: { vulnerabilities: counts } };
}
test('release requires a valid clean audit', () => assert.equal(assessAudit(report()).releaseAllowed, true));
for (const level of ['info', 'low', 'moderate', 'high', 'critical']) {
  test(`${level} findings block release without silently excluding development dependencies`, () => {
    const value = assessAudit(report(level));
    assert.equal(value.releaseAllowed, false);
    assert.equal(value.counts[level], 1);
  });
}
test('missing, failed, unsupported and contradictory audit data fail closed', () => {
  for (const value of [null, {}, { ...report(), error: { code: 'NETWORK' } },
    { ...report(), auditReportVersion: 3 }, report('unknown'),
    { ...report('high'), vulnerabilities: {} }]) assert.throws(() => assessAudit(value));
});
test('Forge can require the unified rebuild API on the supported Node runtime', () => {
  const require = createRequire(import.meta.url);
  const forgeRequire = createRequire(require.resolve('@electron-forge/core-utils'));
  assert.equal(forgeRequire.resolve('@electron/rebuild'), require.resolve('@electron/rebuild'));
  assert.equal(typeof forgeRequire('@electron/rebuild').rebuild, 'function');
});
test('external-editor creates, reads and removes a temporary file with the patched helper', () => {
  const require = createRequire(import.meta.url);
  const { ExternalEditor } = require('external-editor');
  const editor = new ExternalEditor('C.C. Lime dependency compatibility fixture');
  const filename = editor.tempFile;
  try { assert.equal(fs.readFileSync(filename, 'utf8'), editor.text); }
  finally { editor.cleanup(); }
  assert.equal(fs.existsSync(filename), false);
});
