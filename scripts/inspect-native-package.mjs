import { _electron as electron } from '@playwright/test';
import { extractFile, listPackage } from '@electron/asar';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { readElectronFuses, hardeningGaps } from './native-package-policy.mjs';
import { privateValues } from './private-values.mjs';

const output = path.resolve('test-results/native-package');
await fs.mkdir(output, { recursive: true });
// A failed run must not leave an earlier success report under the same name.
await fs.rm(path.join(output, 'summary.json'), { force: true });
if (process.platform !== 'win32') throw new Error('This evidence collector currently verifies Windows packages only.');
if (process.argv.length > 3) throw new Error('Supply at most one packaged executable path.');
const executable = path.resolve(process.argv[2] ?? 'out/C.C. Lime-win32-x64/cc-lime.exe');
const root = path.dirname(executable), archive = path.join(root, 'resources/app.asar');
const manifest = JSON.parse(extractFile(archive, 'package.json').toString('utf8'));
assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
const files = [];
async function hash(file) { const digest = createHash('sha256'); for await (const bytes of createReadStream(file)) digest.update(bytes); return digest.digest('hex'); }
async function walk(directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name), stat = await fs.lstat(filename);
    if (stat.isSymbolicLink()) throw new Error('Package inventory rejects linked paths.');
    if (stat.isDirectory()) await walk(filename);
    else if (stat.isFile()) files.push({ path: path.relative(root, filename).replaceAll('\\', '/'), bytes: stat.size, sha256: await hash(filename), native: /\.(?:exe|dll|node)$/i.test(entry.name) });
    else throw new Error('Package contains an unsupported filesystem entry.');
  }
}
await walk(root);
files.sort((a, b) => a.path.localeCompare(b.path));
const fuses = readElectronFuses(await fs.readFile(executable));
// Static PowerShell program; paths travel as environment data, never shell code.
const signatureScript = `$ErrorActionPreference='Stop'; $root=$env:CC_LIME_INSPECT_ROOT; $rows=@(Get-ChildItem -LiteralPath $root -File -Recurse | Where-Object { $_.Extension -in '.exe','.dll','.node' } | ForEach-Object { $sig=Get-AuthenticodeSignature -LiteralPath $_.FullName; [pscustomobject]@{path=$_.FullName.Substring($root.Length+1).Replace('\\','/'); status=[string]$sig.Status; signer=$sig.SignerCertificate.Subject; thumbprint=$sig.SignerCertificate.Thumbprint} }); ConvertTo-Json -InputObject $rows -Depth 4 -Compress`;
const signatures = JSON.parse(execFileSync('pwsh.exe', ['-NoProfile', '-NonInteractive', '-Command', signatureScript], { encoding: 'utf8', timeout: 60000, windowsHide: true, env: { ...process.env, CC_LIME_INSPECT_ROOT: root }, stdio: ['ignore', 'pipe', 'pipe'] }));
assert.ok(Array.isArray(signatures));
assert.deepEqual(signatures.map(s => s.path).sort(), files.filter(f => f.native).map(f => f.path).sort(), 'Native signature inventory coverage');
const profile = path.resolve('test-results/profiles', `native-inspection-${randomUUID()}`);
const app = await electron.launch({ executablePath: executable, args: [`--cc-lime-test-profile=${profile}`], timeout: 60000 });
app.context().setDefaultTimeout(30000);
let runtime;
try {
  await (await app.firstWindow()).waitForFunction(() => !!window.lime);
  runtime = await app.evaluate(({ app }, expectedProfile) => {
    if (app.getPath('userData') !== expectedProfile) throw new Error('Inspector must use its isolated profile.');
    const nativeRequire = process.getBuiltinModule('module').createRequire(`${app.getAppPath()}/package.json`);
    const Database = nativeRequire('better-sqlite3'), db = new Database(':memory:');
    try {
      return { version: app.getVersion(), packaged: app.isPackaged, platform: process.platform, arch: process.arch, versions: process.versions,
        betterSqlite3: nativeRequire('better-sqlite3/package.json').version,
        sqlite: db.prepare('SELECT sqlite_version() AS version, sqlite_source_id() AS sourceId').get(),
        compileOptions: db.pragma('compile_options').map(row => row.compile_options).sort() };
    } finally { db.close(); }
  }, profile);
} finally {
  let deadline;
  try {
    await Promise.race([app.close(), new Promise((_, reject) => {
      deadline = setTimeout(() => reject(new Error('Isolated inspection app did not close; no report produced.')), 20000);
    })]);
  } catch (error) {
    // Only this collector's disposable test process is eligible for cleanup.
    app.process().kill();
    throw error;
  } finally { clearTimeout(deadline); }
}
assert.equal(runtime.version, manifest.version); assert.equal(runtime.packaged, true);
assert.equal(runtime.versions.electron, manifest.devDependencies.electron, 'Packaged Electron runtime must match its pinned manifest.');
assert.equal(runtime.platform, 'win32'); assert.equal(runtime.arch, 'x64');
const gaps = hardeningGaps(fuses);
const notices = { electronLicensePresent: files.some(file => file.path === 'LICENSE'), chromiumNoticesPresent: files.some(file => file.path === 'LICENSES.chromium.html'),
  archiveNoticePaths: listPackage(archive).map(name => name.replaceAll('\\', '/')).filter(name => /\/(?:license|licence|notice|copying)(?:\.|$)/i.test(name)).sort(),
  limitation: 'Presence inventory only; complete redistribution obligations and bundled JavaScript attribution still require review.' };
// Rehash after inspection so concurrent replacement cannot receive mixed evidence.
for (const file of files) assert.equal(await hash(path.join(root, file.path)), file.sha256, 'Package bytes changed during inspection.');
const report = { generatedAt: new Date().toISOString(), version: manifest.version, scope: 'Read-only Windows package inventory, runtime identities, signature observations and fuse configuration; not comprehensive native advisory coverage or production approval.', runtime, fuses,
  hardening: { evaluated: true, selectedTargetsSatisfied: gaps.length === 0, gaps, limitation: 'Selected fuse targets only; signing, native advisory review and other release gates remain separate.' },
  files, signatures, notices, nativeFileCount: signatures.length,
  excluded: ['Squirrel installer/update executables outside this package', 'Internal Chromium third-party versions beyond runtime metadata and notices', 'Build-only Rust/C++ transitive component advisory assessment', 'OS drivers and Windows components'] };
const body = JSON.stringify(report, null, 2);
if (/AIza[0-9A-Za-z_-]{35}|GOCSPX-[0-9A-Za-z_-]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(body) || privateValues().some(value => body.includes(value))) throw new Error('Private value detected; evidence not written.');
await fs.writeFile(path.join(output, 'summary.json'), body);
console.log(`Inspected ${files.length} files (${signatures.length} native), Electron ${runtime.versions.electron}, SQLite ${runtime.sqlite.version}. Selected fuse hardening gaps: ${gaps.length}; Chromium notices present: ${notices.chromiumNoticesPresent}. Inventory success does not approve production release.`);
