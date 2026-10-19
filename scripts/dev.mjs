import { spawn } from 'node:child_process';
import { createServer } from 'vite';
import { build } from 'esbuild';
import electron from 'electron';
import { rebuild } from '@electron/rebuild';
import { readFile, writeFile } from 'node:fs/promises';
const nativePath='node_modules/better-sqlite3/build/Release/better_sqlite3.node';
const nodeBinary=await readFile(nativePath);
let server,child;
try{
await rebuild({buildPath:process.cwd(),electronVersion:JSON.parse(await readFile('node_modules/electron/package.json','utf8')).version,onlyModules:['better-sqlite3']});
await build({ entryPoints: ['src/main/index.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: 'dist/main/index.cjs', external: ['electron', 'better-sqlite3'] });
await build({ entryPoints: ['src/preload/index.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: 'dist/main/preload.cjs', external: ['electron'] });
await build({entryPoints:['src/main/interchange-worker.ts'],bundle:true,platform:'node',format:'cjs',outfile:'dist/main/interchange-worker.cjs'});
const production=process.argv.includes('--production');
if(!production){server=await createServer();await server.listen();}
child = spawn(electron, ['.'], { stdio: 'inherit', env: { ...process.env,...(!production?{CC_LIME_DEV_URL:'http://127.0.0.1:5173'}:{}) } });
process.on('SIGINT',()=>child?.kill());process.on('SIGTERM',()=>child?.kill());
process.exitCode=await new Promise((resolve,reject)=>{child.once('exit',code=>resolve(code??0));child.once('error',reject);});
}finally{await server?.close();await writeFile(nativePath,nodeBinary);}
