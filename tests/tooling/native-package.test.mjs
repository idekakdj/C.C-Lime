import test from 'node:test';
import assert from 'node:assert/strict';
import { fuseSentinel, readElectronFuses, hardeningGaps } from '../../scripts/native-package-policy.mjs';

const wire = (states = '101100011', version = 1, length = 9) => Buffer.concat([Buffer.from('MZ'), fuseSentinel, Buffer.from([version, length]), Buffer.from(states)]);
test('reads the published Electron fuse wire without changing executable bytes', () => {
  const bytes = wire(), before = Buffer.from(bytes), result = readElectronFuses(bytes);
  assert.deepEqual(bytes, before);
  assert.equal(result.version, 1);
  assert.deepEqual(result.values, { runAsNode: true, cookieEncryption: false, nodeOptions: true, nodeCliInspect: true, embeddedAsarIntegrityValidation: false, onlyLoadAppFromAsar: false, loadBrowserProcessSpecificV8Snapshot: false, grantFileProtocolExtraPrivileges: true, wasmTrapHandlers: true });
  assert.equal(hardeningGaps(result).length, 7);
});
test('rejects absent or duplicate sentinels instead of reporting default security settings', () => {
  assert.throws(() => readElectronFuses(Buffer.from('MZ')), /sentinel/);
  assert.throws(() => readElectronFuses(Buffer.concat([wire(), wire()])), /sentinel/);
});
test('rejects future schema versions and changed lengths requiring explicit review', () => {
  assert.throws(() => readElectronFuses(wire('101100011', 2)), /schema/);
  assert.throws(() => readElectronFuses(wire('1011000110', 1, 10)), /schema/);
  assert.throws(() => readElectronFuses(wire('', 1, 0)), /schema/);
});
test('rejects truncated headers and wires', () => {
  assert.throws(() => readElectronFuses(fuseSentinel), /header/);
  assert.throws(() => readElectronFuses(Buffer.concat([fuseSentinel, Buffer.from([1])])), /header/);
  assert.throws(() => readElectronFuses(wire('10110001')), /wire/);
});
test('rejects unknown or binary states rather than treating them as disabled', () => {
  assert.throws(() => readElectronFuses(wire('10110001x')), /state/);
  assert.throws(() => readElectronFuses(wire('10110001\0')), /state/);
});
test('records removed fuses without accepting them as verified protection', () => {
  const result = readElectronFuses(wire('r10011001'));
  assert.equal(result.values.runAsNode, 'removed');
  assert.deepEqual(hardeningGaps(result), [{ name: 'runAsNode', observed: 'removed', desired: false }]);
});
test('reports no selected gaps only when every reviewed hardening target matches', () => {
  assert.deepEqual(hardeningGaps(readElectronFuses(wire('010011001'))), []);
  assert.ok(hardeningGaps({ values: {} }).every(gap => gap.observed === 'unknown'));
});
