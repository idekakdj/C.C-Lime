import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';

const reviewed = new Set(['MIT', 'ISC', 'BSD-2-Clause', 'BSD-3-Clause', 'Apache-2.0', '0BSD', 'MPL-2.0']);
const digest = text => createHash('sha256').update(text).digest('hex');
const inside = (root, file) => { const relative = path.relative(root, file); return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative); };
export function collectNotices(workspace, inputs, runtime = []) {
  const root = fs.realpathSync(workspace), modules = path.join(root, 'node_modules'), packages = new Map(), sources = [];
  function add(directory, area) {
    const real = fs.realpathSync(directory);
    if (!inside(modules, real)) throw Error('License input escaped the dependency tree.');
    const manifest = JSON.parse(fs.readFileSync(path.join(real, 'package.json'), 'utf8'));
    if (typeof manifest.name !== 'string' || typeof manifest.version !== 'string' || !reviewed.has(manifest.license)) throw Error(`Unreviewed dependency license: ${manifest.name ?? 'unknown'}.`);
    const id = `${manifest.name}@${manifest.version}`;
    const files = fs.readdirSync(real).filter(name => /^(?:licen[cs]e|copying|notice)(?:[._-].*)?$/i.test(name)).sort();
    const notices = files.map(name => {
      const file = path.join(real, name), stat = fs.lstatSync(file);
      if (!stat.isFile() || stat.size < 1 || stat.size > 2 * 1024 * 1024) throw Error(`Invalid license file for ${id}.`);
      const text = fs.readFileSync(file, 'utf8');
      return { name, text, sha256: digest(text) };
    });
    if (!notices.length) throw Error(`Missing dependency license text: ${id}.`);
    if (packages.has(id)) {
      const previous = packages.get(id);
      if (previous.license !== manifest.license || JSON.stringify(previous.notices) !== JSON.stringify(notices)) throw Error(`Conflicting license copies: ${id}.`);
      previous.areas.add(area); return manifest;
    }
    const sourceFiles = [];
    if (manifest.license === 'MPL-2.0') {
      if (id !== 'ical.js@2.2.1') throw Error(`Unreviewed covered-source distribution: ${id}.`);
      let bytes = 0;
      const collect = relative => {
        const file = path.join(real, relative), stat = fs.lstatSync(file);
        if (stat.isDirectory()) { for (const child of fs.readdirSync(file).sort()) collect(path.join(relative, child)); return; }
        if (!stat.isFile() || (bytes += stat.size) > 10 * 1024 * 1024 || sourceFiles.length >= 1000) throw Error('Invalid or oversized covered-source tree.');
        const content = fs.readFileSync(file), destination = `ical.js-2.2.1/${relative.replaceAll('\\', '/')}`;
        sourceFiles.push({ path: destination, bytes: content.length, sha256: digest(content) }); sources.push({ path: destination, content });
      };
      collect('lib'); collect('LICENSE'); collect('package.json');
      if (sourceFiles.length < 3) throw Error('Covered source is missing.');
    }
    packages.set(id, { name: manifest.name, version: manifest.version, license: manifest.license, sourceFiles, notices, areas: new Set([area]) });
    return manifest;
  }
  for (const [area, values] of Object.entries(inputs)) {
    for (const input of values) {
      const clean = input.replaceAll('\\', '/').split('?')[0];
      if (!clean.includes('node_modules/')) continue;
      const file = fs.realpathSync(path.resolve(root, clean));
      if (!inside(modules, file)) throw Error('Bundled license input escaped the dependency tree.');
      // npm package boundary; nested ESM-format package.json files are not owners.
      const parts = path.relative(modules, file).split(path.sep), start = parts.lastIndexOf('node_modules') + 1;
      const directory = path.join(modules, ...parts.slice(0, start + (parts[start]?.startsWith('@') ? 2 : 1)));
      add(directory, area);
    }
  }
  const visited = new Set();
  function runtimePackage(name, from) {
    const require = createRequire(path.join(from, 'package.json'));
    const manifestFile = require.resolve(`${name}/package.json`), directory = path.dirname(manifestFile);
    if (visited.has(directory)) return; visited.add(directory);
    const manifest = add(directory, 'copied runtime dependency');
    for (const dependency of Object.keys(manifest.dependencies ?? {})) runtimePackage(dependency, directory);
  }
  for (const name of runtime) runtimePackage(name, root);
  if (!packages.size) throw Error('Empty dependency notice inventory.');
  const inventory = [...packages.values()].sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
  const text = 'C.C. Lime third-party JavaScript and copied Node dependency notices\n\n' +
    'Generated from actual bundle inputs and copied runtime dependency manifests. Electron/Chromium notices are supplied separately. This inventory is not a complete native source or legal assessment.\n\n' +
    (sources.length ? 'ical.js 2.2.1 covered source and license are included beside this notice under third-party-source/ical.js-2.2.1 and in the application archive under dist/third-party-source/ical.js-2.2.1. These unmodified covered source files are governed by MPL-2.0; no application terms restrict those source rights.\n\n' : '') +
    inventory.map(p => `${'='.repeat(72)}\n${p.name} ${p.version} (${p.license})\nIncluded in: ${[...p.areas].sort().join(', ')}\n\n${p.notices.map(n => `--- ${n.name} ---\n${n.text}`).join('\n\n')}\n`).join('\n');
  return { text, sources, inventory: { noticeSha256: digest(text), packages: inventory.map(({ notices, areas, ...p }) => ({ ...p, areas: [...areas].sort(), files: notices.map(({ text: _, ...n }) => n) })) } };
}
