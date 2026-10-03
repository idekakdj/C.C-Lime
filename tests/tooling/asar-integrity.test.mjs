import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createPackage, getRawHeader } from '@electron/asar';
import { NtExecutable, NtExecutableResource } from 'resedit';
import { readEmbeddedAsarIntegrity, inspectAsarIntegrity } from '../../scripts/asar-integrity-policy.mjs';

const digest = 'a'.repeat(64);
const entry = (changes = {}) => ({ file: 'resources\\app.asar', alg: 'SHA256', value: digest, ...changes });
const resource = (text = JSON.stringify([entry()]), changes = {}) => ({ type: 'INTEGRITY', id: 'ELECTRONASAR', lang: 1033, codepage: 1200, bin: Buffer.from(text), ...changes });
function executable(entries) {
  const exe = NtExecutable.createEmpty(false, false), resources = NtExecutableResource.from(exe);
  resources.entries.push(...entries); resources.outputResource(exe);
  return Buffer.from(exe.generate());
}
async function archiveFixture(t) {
  const base = path.resolve('test-results/asar-integrity-tests');
  await fs.mkdir(base, { recursive: true });
  const root = await fs.mkdtemp(path.join(base, 'case-'));
  t.after(async () => {
    assert.equal(path.dirname(path.resolve(root)), base, 'Cleanup must stay in the fixture directory');
    await fs.rm(root, { recursive: true, force: true });
  });
  const source = path.join(root, 'source'), archive = path.join(root, 'app.asar');
  await fs.mkdir(source); await fs.writeFile(path.join(source, 'main.js'), 'module.exports = 1;');
  await createPackage(source, archive);
  const hash = createHash('sha256').update(getRawHeader(archive).headerString).digest('hex');
  return { archive, bytes: executable([resource(JSON.stringify([entry({ value: hash })]))]) };
}

test('reads real PE resources without changing executable bytes', () => {
  const bytes = executable([resource()]), original = Buffer.from(bytes);
  assert.deepEqual(readEmbeddedAsarIntegrity(bytes), { file: 'resources\\app.asar', algorithm: 'SHA256', headerSha256: digest });
  assert.deepEqual(bytes, original);
});
test('rejects missing, duplicate-language and case-ambiguous resources', () => {
  for (const rows of [[], [resource(), resource(undefined, { lang: 0 })], [resource(), resource(undefined, { id: 'ElectronAsar' })]]) {
    assert.throws(() => readEmbeddedAsarIntegrity(executable(rows)), /Missing or ambiguous/);
  }
});
test('rejects malformed PE and malformed or oversized JSON resources', () => {
  assert.throws(() => readEmbeddedAsarIntegrity(Buffer.from('not an executable')));
  for (const text of ['[', ' '.repeat(16385)]) assert.throws(() => readEmbeddedAsarIntegrity(executable([resource(text)])), /Malformed|format/);
});
test('rejects duplicate JSON keys, duplicate archive entries and unreviewed shapes', () => {
  const duplicateKey = JSON.stringify([entry()]).replace('"alg":"SHA256"', '"alg":"SHA256","alg":"SHA256"');
  for (const text of [duplicateKey, JSON.stringify([entry(), entry()]), '{}', '[]', '[null]', JSON.stringify([entry({ extra: true })])]) {
    assert.throws(() => readEmbeddedAsarIntegrity(executable([resource(text)])), /ambiguous|Unreviewed/);
  }
});
test('rejects alternate paths, algorithms and malformed digests', () => {
  for (const changes of [{ file: '../app.asar' }, { file: 'resources/app.asar' }, { alg: 'sha1' }, { value: 'A'.repeat(64) }, { value: 'a'.repeat(63) }, { value: null }]) {
    assert.throws(() => readEmbeddedAsarIntegrity(executable([resource(JSON.stringify([entry(changes)]))])), /Unreviewed/);
  }
});
test('compares actual archive header with embedded fingerprint without changing either file', async t => {
  const { archive, bytes } = await archiveFixture(t), before = await fs.readFile(archive);
  const result = inspectAsarIntegrity(bytes, archive);
  assert.equal(result.headerMatches, true);
  assert.match(result.scope, /no runtime enforcement/);
  assert.deepEqual(await fs.readFile(archive), before);
});
test('rejects a valid but modified archive header on a repeated inspection', async t => {
  const { archive, bytes } = await archiveFixture(t);
  inspectAsarIntegrity(bytes, archive);
  const changed = await fs.readFile(archive), offset = changed.indexOf(Buffer.from('main.js'));
  assert.ok(offset >= 0); changed[offset] = 'p'.charCodeAt(0); await fs.writeFile(archive, changed);
  assert.throws(() => inspectAsarIntegrity(bytes, archive), /does not match/);
});
test('rejects oversized and truncated archive headers before allocation', async t => {
  const { archive, bytes } = await archiveFixture(t);
  for (const length of [0, 0xffffffff, 100]) {
    const prefix = Buffer.alloc(8); prefix.writeUInt32LE(4, 0); prefix.writeUInt32LE(length, 4);
    await fs.writeFile(archive, prefix);
    assert.throws(() => inspectAsarIntegrity(bytes, archive), /header length/);
  }
  await fs.writeFile(archive, Buffer.from('bad'));
  assert.throws(() => inspectAsarIntegrity(bytes, archive), /header prefix/);
});
test('does not misrepresent header equality as file-content validation', async t => {
  const { archive, bytes } = await archiveFixture(t), changed = await fs.readFile(archive);
  changed[changed.length - 1] ^= 1; await fs.writeFile(archive, changed);
  assert.equal(inspectAsarIntegrity(bytes, archive).headerMatches, true);
  assert.match(inspectAsarIntegrity(bytes, archive).scope, /no runtime enforcement, file-content validation/);
});
