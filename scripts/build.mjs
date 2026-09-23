import { build } from 'esbuild';
import { build as viteBuild } from 'vite';
import { mkdir, copyFile } from 'node:fs/promises';
await mkdir('dist/main', { recursive: true });
await build({ entryPoints: ['src/main/index.ts'], bundle: true, platform: 'node', target: 'node22', format: 'cjs', outfile: 'dist/main/index.cjs', external: ['electron', 'better-sqlite3'], sourcemap: true });
await build({ entryPoints: ['src/preload/index.ts'], bundle: true, platform: 'node', target: 'node22', format: 'cjs', outfile: 'dist/main/preload.cjs', external: ['electron'] });
await build({ entryPoints: ['src/main/interchange-worker.ts'], bundle: true, platform: 'node', target: 'node22', format: 'cjs', outfile: 'dist/main/interchange-worker.cjs' });
await viteBuild();
await copyFile('assets/icon.png', 'dist/main/icon.png');
