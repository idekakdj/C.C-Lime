import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { assessAudit } from './dependency-policy.mjs';
import { privateValues } from './private-values.mjs';

const release = process.argv.includes('--release');
if (process.argv.slice(2).some(arg => arg !== '--release')) throw new Error('Unknown dependency evidence option.');
const npm = process.env.npm_execpath;
if (!npm || !fs.existsSync(npm)) throw new Error('Run this command through npm run security:report or check:release-security.');
const directory = path.resolve('test-results/supply-chain');
fs.mkdirSync(directory, { recursive: true });
// Remove only this script's success artifacts so a failed refresh cannot look current.
for (const file of ['audit.json', 'sbom.cdx.json', 'summary.json']) {
  fs.rmSync(path.join(directory, file), { force: true });
}
function runJson(args, allowedCodes) {
  const result = spawnSync(process.execPath, [npm, ...args], {
    encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, timeout: 180000,
    env: { ...process.env, NO_COLOR: '1', npm_config_update_notifier: 'false' },
    windowsHide: true,
  });
  if (result.error || !allowedCodes.includes(result.status)) {
    throw new Error(`npm ${args[0]} did not finish successfully; no clean security result is available.`);
  }
  try { return JSON.parse(result.stdout); }
  catch { throw new Error(`npm ${args[0]} returned invalid JSON; no clean security result is available.`); }
}
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const lock = fs.readFileSync('package-lock.json');
const manifest = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const audit = runJson(['audit', '--json', '--ignore-scripts', '--include=dev', '--include=optional', '--include=peer'], [0, 1]);
const assessment = assessAudit(audit);
const sbom = runJson(['sbom', '--package-lock-only', '--sbom-format=cyclonedx', '--sbom-type=application', '--include=dev', '--include=optional', '--include=peer'], [0]);
if (sbom.bomFormat !== 'CycloneDX' || !Array.isArray(sbom.components) || !sbom.components.length ||
    sbom.metadata?.component?.version !== manifest.version) throw new Error('Dependency inventory is incomplete or has the wrong app version.');
if (!lock.equals(fs.readFileSync('package-lock.json'))) throw new Error('Lockfile changed during evidence generation. Run again.');
const files = { 'audit.json': JSON.stringify(audit, null, 2), 'sbom.cdx.json': JSON.stringify(sbom, null, 2) };
const summary = {
  generatedAt: new Date().toISOString(), application: manifest.name, version: manifest.version,
  node: process.version, lockfileSha256: hash(lock),
  scope: 'Full npm lockfile, including build tools and libraries bundled from devDependencies; excludes internal native dependencies of Electron/Chromium and the Rust extractor.',
  components: sbom.components.length, ...assessment,
  artifactSha256: Object.fromEntries(Object.entries(files).map(([name, body]) => [name, hash(body)])),
};
files['summary.json'] = JSON.stringify(summary, null, 2);
const secrets = privateValues();
const credentialPattern = /AIza[0-9A-Za-z_-]{35}|GOCSPX-[0-9A-Za-z_-]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|https?:\/\/[^\s/"@]+:[^\s/"@]+@/;
for (const [name, body] of Object.entries(files)) {
  if (credentialPattern.test(body) || secrets.some(secret => body.includes(secret))) {
    throw new Error(`Credential-like data detected in ${name}; evidence was not written. Values are not printed.`);
  }
}
for (const [name, body] of Object.entries(files)) fs.writeFileSync(path.join(directory, name), body);
console.log(`Inventory: ${summary.components} components. Affected-package findings: ${assessment.counts.total} (${assessment.counts.critical} critical, ${assessment.counts.high} high, ${assessment.counts.moderate} moderate, ${assessment.counts.low} low, ${assessment.counts.info} informational).`);
console.log(`Production dependency gate: ${assessment.releaseAllowed ? 'PASS' : 'BLOCKED'}. Evidence saved under test-results/supply-chain.`);
if (release && !assessment.releaseAllowed) process.exitCode = 1;
