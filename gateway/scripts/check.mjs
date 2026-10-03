import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
for(const file of fs.readdirSync(new URL('../src/',import.meta.url))){if(!file.endsWith('.mjs'))continue;const result=spawnSync(process.execPath,['--check',fileURLToPath(new URL('../src/'+file,import.meta.url))],{encoding:'utf8'});if(result.status!==0){process.stderr.write(result.stderr);process.exit(result.status??1);}}
console.log('Gateway source syntax checked.');
