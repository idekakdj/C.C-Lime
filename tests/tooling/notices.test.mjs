import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { collectNotices } from '../../scripts/third-party-notices.mjs';
function fixture(license = 'MIT') {
  const root = path.resolve('test-results/license-fixtures', randomUUID()), directory = path.join(root, 'node_modules', 'fixture');
  fs.mkdirSync(path.join(directory, 'esm'), { recursive: true }); fs.writeFileSync(path.join(root, 'package.json'), '{}');
  fs.writeFileSync(path.join(directory, 'package.json'), JSON.stringify({ name: 'fixture', version: '1.0.0', license }));
  fs.writeFileSync(path.join(directory, 'LICENSE'), 'Fixture license: preserve exact bytes.\r\n');
  fs.writeFileSync(path.join(directory, 'esm', 'package.json'), '{"type":"module"}'); fs.writeFileSync(path.join(directory, 'esm', 'index.js'), 'export const fixture = true;');
  return { root, directory, input: 'node_modules/fixture/esm/index.js' };
}
test('actual package ownership includes nested ESM manifests, deduplicates areas and retains exact license bytes', () => {
  const f = fixture(), result = collectNotices(f.root, { main: [f.input], renderer: [f.input + '?commonjs-proxy'] }, ['fixture']);
  assert.equal(result.inventory.packages.length, 1); assert.deepEqual(result.inventory.packages[0].areas, ['copied runtime dependency', 'main', 'renderer']);
  assert.ok(result.text.includes(fs.readFileSync(path.join(f.directory, 'LICENSE'), 'utf8')));
  assert.equal(result.inventory.noticeSha256, createHash('sha256').update(result.text).digest('hex'));
});
test('unknown licenses and missing texts fail rather than omit packages', () => {
  const f = fixture('UNREVIEWED'); assert.throws(() => collectNotices(f.root, { main: [f.input] }), /Unreviewed/);
  const missing = fixture(); fs.unlinkSync(path.join(missing.directory, 'LICENSE')); assert.throws(() => collectNotices(missing.root, { main: [missing.input] }), /Missing/);
  assert.throws(() => collectNotices(missing.root, {}), /Empty/);
});
test('license directories and escaping dependency junctions are rejected before reading outside the tree', () => {
  const f = fixture(); fs.unlinkSync(path.join(f.directory, 'LICENSE')); fs.mkdirSync(path.join(f.directory, 'LICENSE')); assert.throws(() => collectNotices(f.root, { main: [f.input] }), /Invalid/);
  const escaped = fixture(), outside = path.join(escaped.root, 'outside'); fs.renameSync(escaped.directory, outside); fs.symlinkSync(outside, escaped.directory, 'junction');
  assert.throws(() => collectNotices(escaped.root, { main: [escaped.input] }), /escaped/);
});
test('same-name/version copies with conflicting license bytes fail instead of hiding one copy', () => {
  const f = fixture(), nested = path.join(f.directory, 'node_modules', 'fixture'); fs.mkdirSync(nested, { recursive: true });
  fs.copyFileSync(path.join(f.directory, 'package.json'), path.join(nested, 'package.json')); fs.writeFileSync(path.join(nested, 'LICENSE'), 'Changed license'); fs.writeFileSync(path.join(nested, 'index.js'), 'x');
  assert.throws(() => collectNotices(f.root, { main: [f.input, 'node_modules/fixture/node_modules/fixture/index.js'] }), /Conflicting/);
});
function covered() {
  const f = fixture('MPL-2.0'); fs.writeFileSync(path.join(f.directory, 'package.json'), JSON.stringify({ name: 'ical.js', version: '2.2.1', license: 'MPL-2.0' }));
  fs.mkdirSync(path.join(f.directory, 'lib')); fs.writeFileSync(path.join(f.directory, 'lib', 'calendar.js'), '/* covered source */\r\nexport const exact = true;'); return f;
}
test('covered source preserves original bytes and hashes in the redistribution inventory', () => {
  const f = covered(), result = collectNotices(f.root, { worker: [f.input] }); assert.equal(result.sources.length, 3);
  const original = fs.readFileSync(path.join(f.directory, 'lib', 'calendar.js')), source = result.sources.find(s => s.path.endsWith('/calendar.js'));
  assert.deepEqual(source.content, original); assert.equal(result.inventory.packages[0].sourceFiles.find(s => s.path === source.path).sha256, createHash('sha256').update(original).digest('hex')); assert.match(result.text, /third-party-source\/ical.js-2.2.1/);
});
test('unreviewed covered versions, missing source and linked source fail closed', () => {
  const f = covered(); fs.writeFileSync(path.join(f.directory, 'package.json'), JSON.stringify({ name: 'ical.js', version: 'future', license: 'MPL-2.0' })); assert.throws(() => collectNotices(f.root, { worker: [f.input] }), /Unreviewed covered/);
  const missing = covered(); fs.unlinkSync(path.join(missing.directory, 'lib', 'calendar.js')); assert.throws(() => collectNotices(missing.root, { worker: [missing.input] }), /missing/);
  const linked = covered(), outside = path.join(linked.root, 'outside'); fs.mkdirSync(outside); fs.writeFileSync(path.join(outside, 'secret.js'), 'do not redistribute'); fs.symlinkSync(outside, path.join(linked.directory, 'lib', 'link'), 'junction'); assert.throws(() => collectNotices(linked.root, { worker: [linked.input] }), /Invalid/);
});
