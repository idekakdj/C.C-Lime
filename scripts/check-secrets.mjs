import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
const names=[...new Set(execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean))];
const signatures=[/AIza[0-9A-Za-z_-]{35}/,/GOCSPX-[0-9A-Za-z_-]{20,}/,/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/];
const found=[];
for(const name of names){if(!fs.existsSync(name)||!fs.statSync(name).isFile()||fs.statSync(name).size>10*1024*1024)continue;const text=fs.readFileSync(name,'utf8');if(signatures.some(pattern=>pattern.test(text)))found.push(name);}
if(found.length){console.error(`Credential-like content found in publishable files:\n${found.join('\n')}\nMove credentials into ignored .local/.env. Values are intentionally not printed.`);process.exit(1);}
console.log(`Checked ${names.length} publishable files; no Google API keys, OAuth secrets, or private-key blocks found.`);
