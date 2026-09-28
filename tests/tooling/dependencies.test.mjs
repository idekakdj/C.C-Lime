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

test('Firebase gaxios resolves patched UUID with its required v4 API and bounds checks', () => {
  const require = createRequire(import.meta.url);
  const fromCli = createRequire(require.resolve('firebase-tools'));
  const fromGaxios = createRequire(fromCli.resolve('gaxios'));
  const uuid = fromGaxios('uuid');
  assert.match(uuid.v4(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.throws(() => uuid.v5('fixture', uuid.v5.DNS, new Uint8Array(1)), RangeError);
});

test('Firebase Pub/Sub trace propagation works with patched OpenTelemetry', () => {
  const require = createRequire(import.meta.url);
  const fromCli = createRequire(require.resolve('firebase-tools'));
  const fromPubSub = createRequire(fromCli.resolve('@google-cloud/pubsub'));
  const { W3CTraceContextPropagator } = fromPubSub('@opentelemetry/core');
  const { ROOT_CONTEXT, trace, defaultTextMapGetter, defaultTextMapSetter } = fromPubSub('@opentelemetry/api');
  const propagator = new W3CTraceContextPropagator(), carrier = {};
  const span = { traceId: '11111111111111111111111111111111', spanId: '2222222222222222', traceFlags: 1 };
  propagator.inject(trace.setSpanContext(ROOT_CONTEXT, span), carrier, defaultTextMapSetter);
  assert.equal(carrier.traceparent, `00-${span.traceId}-${span.spanId}-01`);
  assert.deepEqual(trace.getSpanContext(propagator.extract(ROOT_CONTEXT, carrier, defaultTextMapGetter)), { ...span, isRemote: true });
});

test('Firebase hosting loads native RE2 rather than silently falling back to JavaScript', () => {
  const require = createRequire(import.meta.url);
  const fromCli = createRequire(require.resolve('firebase-tools'));
  const fromHosting = createRequire(fromCli.resolve('superstatic'));
  const RE2 = fromHosting('re2');
  assert.equal(fromHosting('re2/package.json').version, '1.27.0');
  const patterns = fromHosting('./utils/patterns');
  assert.equal(patterns.re2Available(), true);
  assert.equal(patterns.configMatcher('/calendar/week', { regex: '^/calendar/(day|week)$' }), true);
  assert.equal(patterns.configMatcher('/outside', { regex: '^/calendar/(day|week)$' }), false);
  assert.equal(new RE2('(?P<name>é+)', 'u').exec('éé').groups.name, 'éé');
  assert.equal(new RE2('é', 'gu').replace('café', 'e'), 'cafe');
});
