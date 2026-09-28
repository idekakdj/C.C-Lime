import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { zipFixture } from './zip-fixture.mjs';
import policy from '../../scripts/electron-build-policy.cjs';

const require = createRequire(import.meta.url);
const packagerRequire = createRequire(require.resolve('@electron/packager'));
const { extractElectronZip } = packagerRequire('./unzip');
const { Packager } = packagerRequire('./packager');
const { downloadArtifact } = packagerRequire('@electron/get');
const { createDownloadOpts } = packagerRequire('./download');
const manifest = require('../../package.json');
const config = () => ({ packagerConfig: { download: policy.downloadOptions() } });
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

function unavailableSymlink(t, error, detail) {
  if (!['EPERM', 'EACCES'].includes(error.code)) throw error;
  // CI must supply the capable-host evidence missing on a restricted laptop.
  if (process.env.CI) throw new Error(`CI must permit file-symlink creation: ${detail}`, { cause: error });
  t.skip(`Host denies file-symlink creation: ${detail}`);
}

function fixture(t) {
  const parent = fs.realpathSync(os.tmpdir());
  const root = fs.mkdtempSync(path.join(parent, 'cc-lime-extraction-'));
  t.after(() => {
    assert.equal(path.dirname(root), parent); assert.ok(path.basename(root).startsWith('cc-lime-extraction-'));
    assert.equal(fs.realpathSync(root), root); fs.rmSync(root, { recursive: true, force: true });
  });
  const dir = path.join(root, 'out'), sentinel = path.join(root, 'sentinel.txt');
  fs.mkdirSync(dir); fs.writeFileSync(sentinel, 'outside extraction, inside fixture');
  let next = 0;
  return { root, dir, sentinel,
    intact: () => assert.equal(fs.readFileSync(sentinel, 'utf8'), 'outside extraction, inside fixture'),
    archive: entries => { const file = path.join(root, `fixture-${next++}.zip`); fs.writeFileSync(file, zipFixture(entries)); return file; },
  };
}

test('actual packager wrapper resolves the reviewed native extractor and preserves normal files', async t => {
  const f = fixture(t), installed = JSON.parse(fs.readFileSync(path.join(path.dirname(packagerRequire.resolve('extract-zip')), 'package.json')));
  assert.equal(installed.name, '@electron-internal/extract-zip'); assert.equal(installed.version, '1.0.5');
  await extractElectronZip(f.archive([{ name: 'nested/café.txt', data: 'calendar bytes' }, { name: 'empty.txt', data: '' }]), f.dir);
  assert.equal(fs.readFileSync(path.join(f.dir, 'nested/café.txt'), 'utf8'), 'calendar bytes');
  assert.equal(fs.statSync(path.join(f.dir, 'empty.txt')).size, 0);
  await extractElectronZip(f.archive([{ name: 'nested/café.txt', data: 'replacement' }]), f.dir);
  assert.equal(fs.readFileSync(path.join(f.dir, 'nested/café.txt'), 'utf8'), 'replacement'); f.intact();
});

for (const name of ['../sentinel.txt', 'nested/../../sentinel.txt', 'CON', 'nested/AUX.txt']) {
  test(`extractor rejects unsafe archive path ${name}`, async t => {
    const f = fixture(t); await assert.rejects(extractElectronZip(f.archive([{ name, data: 'changed' }]), f.dir));
    f.intact(); assert.deepEqual(fs.readdirSync(f.dir), []);
  });
}

test('absolute archive paths cannot write to an absolute fixture sentinel', async t => {
  const f = fixture(t); await Promise.allSettled([extractElectronZip(f.archive([{ name: f.sentinel.replaceAll('\\', '/'), data: 'changed' }]), f.dir)]);
  f.intact();
  // A sanitized path inside out is also safe; the upstream parser may reject
  // or strip an absolute prefix on different platforms.
  assert.deepEqual(fs.readdirSync(f.root).sort(), ['fixture-0.zip', 'out', 'sentinel.txt']);
});

for (const entries of [
  [{ name: 'escape', mode: 0o120777, data: '../sentinel.txt' }],
  [{ name: 'hop', mode: 0o120777, data: 'escape' }, { name: 'escape', mode: 0o120777, data: '../sentinel.txt' }],
  [{ name: 'escape', data: 'changed' }, { name: 'escape', mode: 0o120777, data: '../sentinel.txt' }],
  [{ name: 'safe', data: 'safe' }, { name: 'Link', mode: 0o120777, data: 'safe' }, { name: 'link', mode: 0o120777, data: 'safe' }],
]) {
  test(`rejects unsafe or duplicate symlink entries: ${entries.map(e => e.name + ':' + e.data).join(', ')}`, async t => {
    const f = fixture(t); await assert.rejects(extractElectronZip(f.archive(entries), f.dir)); f.intact();
    for (const entry of fs.readdirSync(f.dir)) assert.equal(fs.lstatSync(path.join(f.dir, entry)).isSymbolicLink(), false);
  });
}

test('an identical-name link followed by a regular file resolves to that file without following the link', async t => {
  const f = fixture(t);
  await extractElectronZip(f.archive([{ name: 'escape', mode: 0o120777, data: '../sentinel.txt' }, { name: 'escape', data: 'last regular entry' }]), f.dir);
  f.intact(); assert.equal(fs.lstatSync(path.join(f.dir, 'escape')).isSymbolicLink(), false);
  assert.equal(fs.readFileSync(path.join(f.dir, 'escape'), 'utf8'), 'last regular entry');
  assert.deepEqual(fs.readdirSync(f.dir), ['escape']);
});

test('absolute symlink target is refused before link creation', async t => {
  const f = fixture(t); await assert.rejects(extractElectronZip(f.archive([{ name: 'link', mode: 0o120777, data: f.sentinel }]), f.dir));
  f.intact(); assert.deepEqual(fs.readdirSync(f.dir), []);
});

test('relative symlinks remain usable when the host grants symlink privilege', async t => {
  const f = fixture(t), probe = path.join(f.root, 'probe');
  try { fs.symlinkSync(f.sentinel, probe, 'file'); }
  catch (error) { unavailableSymlink(t, error, 'positive symlink behavior is not verified here.'); return; }
  fs.unlinkSync(probe);
  await extractElectronZip(f.archive([{ name: 'file.txt', data: 'safe' }, { name: 'link', mode: 0o120777, data: 'file.txt' }]), f.dir);
  assert.equal(fs.lstatSync(path.join(f.dir, 'link')).isSymbolicLink(), true);
  assert.equal(fs.readFileSync(path.join(f.dir, 'link'), 'utf8'), 'safe'); f.intact();
});

test('pre-existing leaf link is replaced without overwriting its outside target', async t => {
  const f = fixture(t), link = path.join(f.dir, 'leaf');
  try { fs.symlinkSync(f.sentinel, link, 'file'); }
  catch (error) { unavailableSymlink(t, error, 'leaf-link case requires another capable host.'); return; }
  await extractElectronZip(f.archive([{ name: 'leaf', data: 'safe replacement' }]), f.dir);
  f.intact(); assert.equal(fs.lstatSync(link).isSymbolicLink(), false); assert.equal(fs.readFileSync(link, 'utf8'), 'safe replacement');
});

test('pre-existing parent junction cannot route writes outside the extraction directory', async t => {
  const f = fixture(t), outside = path.join(f.root, 'outside'); fs.mkdirSync(outside);
  const sentinel = path.join(outside, 'sentinel.txt'); fs.writeFileSync(sentinel, 'intact');
  fs.symlinkSync(outside, path.join(f.dir, 'parent'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(extractElectronZip(f.archive([{ name: 'parent/sentinel.txt', data: 'changed' }]), f.dir));
  assert.equal(fs.readFileSync(sentinel, 'utf8'), 'intact'); f.intact();
});

test('duplicate regular entries stay inside the extraction directory', async t => {
  const f = fixture(t);
  const [outcome] = await Promise.allSettled([extractElectronZip(f.archive([{ name: 'file', data: 'first' }, { name: 'file', data: 'second' }]), f.dir)]);
  f.intact(); assert.deepEqual(fs.readdirSync(f.dir), ['file']);
  if (outcome.status === 'fulfilled') assert.ok(['first', 'second'].includes(fs.readFileSync(path.join(f.dir, 'file'), 'utf8')));
});

test('actual downloader verifies fresh data, cache hits, corrupt cache recovery and corrupt downloads', async t => {
  const f = fixture(t), good = zipFixture([{ name: 'file', data: 'trusted fixture' }]); let downloads = 0, corrupt = false;
  const details = { version: policy.target.version, platform: 'win32', arch: 'x64', artifactName: 'electron',
    cacheRoot: path.join(f.root, 'cache'), tempDirectory: f.root,
    checksums: { [policy.target.filename]: sha(good) },
    downloader: { download: async (_url, destination) => { downloads++; fs.writeFileSync(destination, corrupt ? Buffer.from('corrupt') : good); } },
  };
  const first = await downloadArtifact(details); assert.equal(downloads, 1); assert.equal(sha(fs.readFileSync(first)), sha(good));
  assert.equal(await downloadArtifact(details), first); assert.equal(downloads, 1);
  fs.writeFileSync(first, 'corrupted cache'); assert.equal(await downloadArtifact(details), first); assert.equal(downloads, 2);
  assert.equal(sha(fs.readFileSync(first)), sha(good));
  corrupt = true; await assert.rejects(downloadArtifact({ ...details, force: true }), /checksum/i); assert.equal(downloads, 3);
  assert.equal(sha(fs.readFileSync(first)), sha(good)); f.intact();
});

test('build policy pins the official target digest through packager download options', () => {
  const value = config(); policy.validateBuild(value, 'win32', 'x64', manifest, {});
  const options = createDownloadOpts({ ...value.packagerConfig, electronVersion: policy.target.version }, 'win32', 'x64');
  assert.deepEqual(options.checksums, { [policy.target.filename]: policy.target.sha256 });
  assert.equal(options.unsafelyDisableChecksums, false);
  assert.equal(require('electron/checksums.json')[policy.target.filename], policy.target.sha256);
});

test('unreviewed archive, environment and target overrides fail before making a build directory', async t => {
  const f = fixture(t), before = fs.readdirSync(f.root);
  for (const edit of [c => c.packagerConfig.electronZipDir = f.root, c => c.packagerConfig.tmpdir = false,
    c => c.packagerConfig.download.unsafelyDisableChecksums = true, c => c.packagerConfig.download.checksums = {},
    c => c.packagerConfig.download.downloader = {}, c => c.packagerConfig.download.mirrorOptions = {}]) {
    const value = config(); edit(value); await assert.rejects(policy.beginBuild(value, 'win32', 'x64', manifest, {}, f.root));
  }
  for (const key of ['ELECTRON_MIRROR', 'ELECTRON_CUSTOM_VERSION', 'npm_config_electron_customfilename', 'NPM_CONFIG_ELECTRON_CUSTOM_DIR', 'npm_package_config_electron_nightlyMirror']) {
    await assert.rejects(policy.beginBuild(config(), 'win32', 'x64', manifest, { [key]: 'fixture' }, f.root));
  }
  await assert.rejects(policy.beginBuild(config(), 'linux', 'x64', manifest, {}, f.root));
  await assert.rejects(policy.beginBuild(config(), 'win32', 'arm64', manifest, {}, f.root));
  await assert.rejects(policy.beginBuild(config(), 'win32', 'x64', { devDependencies: { electron: '99.0.0' } }, {}, f.root));
  assert.deepEqual(fs.readdirSync(f.root), before); f.intact();
});

test('each package build owns a fresh empty extraction directory and only its own cleanup', async t => {
  const f = fixture(t), a = config(), b = config();
  await policy.beginBuild(a, 'win32', 'x64', manifest, {}, f.root); await policy.beginBuild(b, 'win32', 'x64', manifest, {}, f.root);
  const rootA = a.packagerConfig.tmpdir, rootB = b.packagerConfig.tmpdir; assert.notEqual(rootA, rootB);
  const packager = new Packager(a.packagerConfig); await packager.ensureTempDir();
  const dir = await packager.buildDir('win32', 'x64'); assert.ok(dir.startsWith(rootA + path.sep)); assert.deepEqual(fs.readdirSync(dir), []);
  await policy.finishBuild(a); assert.equal(fs.existsSync(rootA), false); assert.equal(fs.existsSync(rootB), true);
  await policy.finishBuild(a); await policy.finishBuild(b); f.intact();
});

test('cleanup refuses a root replaced with a junction to another fixture directory', async t => {
  const f = fixture(t), value = config(); await policy.beginBuild(value, 'win32', 'x64', manifest, {}, f.root);
  const root = value.packagerConfig.tmpdir; fs.rmdirSync(root);
  fs.symlinkSync(f.dir, root, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(policy.finishBuild(value), /cleanup refused/);
  assert.equal(fs.existsSync(f.dir), true); f.intact(); fs.unlinkSync(root);
});
