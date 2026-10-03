// Runs the real Electron image decoder in a separate, synthetic user-data root.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { build } from 'esbuild';
import sharp from 'sharp';
const base=path.resolve('test-results/avatar-adversarial'),root=path.join(base,randomUUID());
assert.equal(path.dirname(root),base);await fs.mkdir(root,{recursive:true});
await build({entryPoints:['src/main/avatar.ts'],bundle:true,platform:'node',format:'cjs',outfile:path.join(root,'avatar.cjs'),external:['electron']});
const fixtures=[];
async function fixture(name,bytes,accepted){const filename=path.join(root,name);await fs.writeFile(filename,bytes);fixtures.push({filename,accepted});}
for(const [width,height] of [[1,1],[1,4096],[4096,1],[600,200],[200,600],[4096,4096]]){
 await fixture(`valid-${width}-${height}.png`,await sharp({create:{width,height,channels:4,background:{r:95,g:60,b:170,alpha:.6}}}).png().toBuffer(),true);
}
await fixture('valid-jpeg-disguised.txt',await sharp({create:{width:400,height:200,channels:3,background:'#ab89de'}}).jpeg().toBuffer(),true);
await fixture('deceptive-svg.png',Buffer.from('<svg onload="alert(1)"></svg>'),false);
await fixture('empty.png',Buffer.alloc(0),false);
await fixture('oversized.png',Buffer.alloc(5*1024*1024+1),false);
const valid=await fs.readFile(fixtures[3].filename);
for(const length of [1,8,16,32,33,40])await fixture(`truncated-${length}.png`,valid.subarray(0,length),false);
for(const dimension of [0,4097,0xffffffff]){const bytes=Buffer.from(valid);bytes.writeUInt32BE(dimension,16);await fixture(`forged-width-${dimension}.png`,bytes,false);}
await fixture('malformed-jpeg.png',Buffer.from([0xff,0xd8,0xff,0xc0,0x00,0x08,0x08,0x00,0x10,0x00,0x10,0x00]),false);
for(const suffix of [Buffer.from('<script>evil()</script>'),Buffer.from([0,1,2,0xff])])await fixture(`trailing-${fixtures.length}.png`,Buffer.concat([valid,suffix]),true);
await fs.writeFile(path.join(root,'fixtures.json'),JSON.stringify(fixtures));
const script=`const {app,nativeImage}=require('electron');const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');const {prepareAvatar,avatarDimensions}=require('./avatar.cjs');app.setName('C.C. Lime avatar security test');app.setPath('userData',path.join(__dirname,'profile'));app.whenReady().then(()=>{let accepted=0,rejected=0,crops=0;for(const fixture of JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures.json'),'utf8'))){let photo,error;try{photo=prepareAvatar(fixture.filename,bytes=>nativeImage.createFromBuffer(bytes));}catch(e){error=e;}if(!fixture.accepted){assert.ok(error,'Malformed image was accepted: '+path.basename(fixture.filename));rejected++;continue;}assert.ifError(error);accepted++;for(const zoom of [1,4])for(const horizontal of [0,.5,1])for(const vertical of [0,.5,1]){const result=photo.render({zoom,horizontal,vertical});assert.deepEqual(avatarDimensions(Buffer.from(result.split(',')[1],'base64')),{width:128,height:128});assert.ok(result.length<100000);crops++;}}const report={cases:accepted+rejected,accepted,rejected,crops,actualElectronDecoder:true,syntheticProfile:true};fs.writeFileSync(path.join(__dirname,'report.json'),JSON.stringify(report,null,2));app.quit();}).catch(error=>{console.error(error.message);app.exit(1);});`;
await fs.writeFile(path.join(root,'probe.cjs'),script);
const env={...process.env};for(const key of ['ELECTRON_RUN_AS_NODE','NODE_OPTIONS','NODE_EXTRA_CA_CERTS','ELECTRON_NO_ASAR'])delete env[key];
const child=spawn(path.resolve('node_modules/electron/dist/electron.exe'),[path.join(root,'probe.cjs'),'--no-error-dialogs'],{env,cwd:root,windowsHide:true,stdio:['ignore','ignore','pipe']});
let stderr='',timer;child.stderr.on('data',chunk=>{stderr=(stderr+chunk.toString()).slice(0,4000);});
try{const outcome=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',(code,signal)=>resolve({code,signal}));timer=setTimeout(()=>{child.kill();reject(Error('Owned avatar test timed out; not accepted'));},30000);});assert.deepEqual(outcome,{code:0,signal:null},stderr);const report=JSON.parse(await fs.readFile(path.join(root,'report.json'),'utf8'));console.log(JSON.stringify({...report,root,normalExit:true}));}
finally{if(timer)clearTimeout(timer);}
