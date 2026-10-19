import { listPackage, extractFile } from '@electron/asar';
import fs from 'node:fs';
import path from 'node:path';
import { privateValues } from './private-values.mjs';
import { createHash } from 'node:crypto';
const privateEntries=privateValues();
const archive=path.resolve(process.argv[2]??'out/C.C. Lime-win32-x64/resources/app.asar');
const signatures=[/AIza[0-9A-Za-z_-]{35}/,/GOCSPX-[0-9A-Za-z_-]{20,}/,/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/];
const files=listPackage(archive),bad=[];
for(const entry of files){const name=entry.replaceAll('\\','/');if(/\/(?:\.local|\.tools|\.env|cloud\/client\.json|\.dev\.vars|\.wrangler)(?:\/|$|\.)/.test(name)||/^\/(?:gateway|release|out|build|test-results|playwright-report)(?:\/|$)/.test(name))bad.push(name);if(!/\.(?:js|cjs|mjs|json|map|html|css|txt|md)$/.test(name))continue;try{const text=extractFile(archive,entry.replace(/^[/\\]/,'')).toString('utf8');if(signatures.some(regex=>regex.test(text))||privateEntries.some(value=>text.includes(value)))bad.push(name);}catch(error){if(!String(error.message).includes('directory'))throw error;}}
if(bad.length){const unique=[...new Set(bad)];throw new Error(`Package includes credential-like content or excluded configuration paths (${unique.length} entries): ${unique.slice(0,12).join(', ')}${unique.length>12?', …':''}. Values not printed.`);}
const manifest=JSON.parse(extractFile(archive,'package.json').toString());
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const notice = extractFile(archive, 'dist/THIRD_PARTY_NOTICES.txt'), inventory = JSON.parse(extractFile(archive, 'dist/third-party-inventory.json').toString());
if (!inventory.packages?.length || hash(notice) !== inventory.noticeSha256 || hash(fs.readFileSync(path.join(path.dirname(archive), 'THIRD_PARTY_NOTICES.txt'))) !== inventory.noticeSha256) throw Error('Package dependency notices are missing or changed.');
let coveredSourceFiles = 0;
for (const component of inventory.packages) for (const source of component.sourceFiles) {
  if (!/^ical\.js-2\.2\.1\/(?:lib\/[A-Za-z0-9_./-]+\.js|LICENSE|package\.json)$/.test(source.path) || source.path.split('/').includes('..')) throw Error('Unreviewed covered-source package path.');
  const inside = extractFile(archive, path.join('dist', 'third-party-source', ...source.path.split('/'))), outside = fs.readFileSync(path.join(path.dirname(archive), 'third-party-source', source.path));
  if (inside.length !== source.bytes || outside.length !== source.bytes || hash(inside) !== source.sha256 || hash(outside) !== source.sha256) throw Error('Package covered-source bytes differ.'); coveredSourceFiles++;
}
console.log(`Verified ${inventory.packages.length} dependency notices and ${coveredSourceFiles} unchanged covered-source files inside and beside the archive.`);
const report={archive,version:manifest.version,entries:files.length,credentialPatternsFound:0,excludedPathsFound:0};
fs.mkdirSync('test-results',{recursive:true});fs.writeFileSync('test-results/package-security.json',JSON.stringify(report,null,2));console.log(`Inspected ${files.length} archive entries; no credential values or local configuration files found.`);
