import { build } from 'esbuild';
import { build as viteBuild } from 'vite';
import { mkdir, copyFile, writeFile, rm } from 'node:fs/promises';
import { collectNotices } from './third-party-notices.mjs';
import path from 'node:path';
const inputs = {}, rendererInputs = new Set();
// Remove success evidence before building so a failed refresh cannot ship stale notices.
await rm('dist/THIRD_PARTY_NOTICES.txt', { force: true });
await rm('dist/third-party-inventory.json', { force: true });
const sourceDirectory = path.resolve('dist/third-party-source');
if (sourceDirectory !== path.join(process.cwd(), 'dist', 'third-party-source')) throw Error('Unexpected source-notice output path.');
await rm(sourceDirectory, { recursive: true, force: true });
const remember = (area, result) => { inputs[area] = [...new Set(Object.values(result.metafile.outputs).flatMap(output => Object.entries(output.inputs ?? {}).filter(([, info]) => info.bytesInOutput > 0).map(([file]) => file)))]; };
const licensePlugin = () => ({ name: 'cc-lime-bundle-license-inputs', generateBundle(_options, bundle) { for (const item of Object.values(bundle)) if (item.type === 'chunk') for (const id of item.moduleIds) rendererInputs.add(id); } });
await mkdir('dist/main', { recursive: true });
remember('main bundle', await build({ entryPoints: ['src/main/index.ts'], bundle: true, metafile: true, platform: 'node', target: 'node22', format: 'cjs', outfile: 'dist/main/index.cjs', external: ['electron', 'better-sqlite3'], sourcemap: true }));
remember('preload bundle', await build({ entryPoints: ['src/preload/index.ts'], bundle: true, metafile: true, platform: 'node', target: 'node22', format: 'cjs', outfile: 'dist/main/preload.cjs', external: ['electron'] }));
remember('interchange worker bundle', await build({ entryPoints: ['src/main/interchange-worker.ts'], bundle: true, metafile: true, platform: 'node', target: 'node22', format: 'cjs', outfile: 'dist/main/interchange-worker.cjs' }));
await viteBuild({ plugins: [licensePlugin()], worker: { plugins: () => [licensePlugin()] } });
inputs['renderer/worker bundles'] = [...rendererInputs];
const notices = collectNotices(process.cwd(), inputs, ['better-sqlite3']);
for (const source of notices.sources) { const file = path.join(sourceDirectory, source.path); await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, source.content); }
await writeFile('dist/THIRD_PARTY_NOTICES.txt', notices.text);
await writeFile('dist/third-party-inventory.json', JSON.stringify(notices.inventory, null, 2));
console.log(`Retained license texts for ${notices.inventory.packages.length} bundled/copied dependencies.`);
await copyFile('assets/icon.png', 'dist/main/icon.png');
