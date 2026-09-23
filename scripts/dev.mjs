import { spawn } from 'node:child_process';
import { createServer } from 'vite';
import { build } from 'esbuild';
import electron from 'electron';
await build({ entryPoints: ['src/main/index.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: 'dist/main/index.cjs', external: ['electron', 'better-sqlite3'] });
await build({ entryPoints: ['src/preload/index.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: 'dist/main/preload.cjs', external: ['electron'] });
const server = await createServer(); await server.listen();
const child = spawn(electron, ['.'], { stdio: 'inherit', env: { ...process.env, CC_LIME_DEV_URL: 'http://127.0.0.1:5173' } });
child.on('exit', async code => { await server.close(); process.exit(code ?? 0); });
