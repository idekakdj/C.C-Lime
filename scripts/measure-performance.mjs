import { build } from 'esbuild';
import fs from 'node:fs/promises';
await fs.mkdir('.tools',{recursive:true});
await build({entryPoints:['scripts/performance.ts'],bundle:true,platform:'node',format:'esm',packages:'external',outfile:'.tools/performance.mjs'});
await import('../.tools/performance.mjs');
