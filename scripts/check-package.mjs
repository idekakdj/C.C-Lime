import { listPackage, extractFile } from '@electron/asar';
import fs from 'node:fs';
import path from 'node:path';
import { privateValues } from './private-values.mjs';
const privateEntries=privateValues();
const archive=path.resolve(process.argv[2]??'out/C.C. Lime-win32-x64/resources/app.asar');
const signatures=[/AIza[0-9A-Za-z_-]{35}/,/GOCSPX-[0-9A-Za-z_-]{20,}/,/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/];
const files=listPackage(archive),bad=[];
for(const entry of files){const name=entry.replaceAll('\\','/');if(/\/(?:\.local|\.tools|\.env|cloud\/client\.json)(?:\/|$|\.)/.test(name))bad.push(name);if(!/\.(?:js|cjs|mjs|json|map|html|css|txt|md)$/.test(name))continue;try{const text=extractFile(archive,entry.replace(/^[/\\]/,'')).toString('utf8');if(signatures.some(regex=>regex.test(text))||privateEntries.some(value=>text.includes(value)))bad.push(name);}catch(error){if(!String(error.message).includes('directory'))throw error;}}
if(bad.length)throw new Error(`Package includes credential-like content or excluded configuration paths: ${[...new Set(bad)].join(', ')}. Values not printed.`);
const manifest=JSON.parse(extractFile(archive,'package.json').toString());
const report={archive,version:manifest.version,entries:files.length,credentialPatternsFound:0,excludedPathsFound:0};
fs.mkdirSync('test-results',{recursive:true});fs.writeFileSync('test-results/package-security.json',JSON.stringify(report,null,2));console.log(`Inspected ${files.length} archive entries; no credential values or local configuration files found.`);
