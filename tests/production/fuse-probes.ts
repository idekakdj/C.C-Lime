import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import type {AcceptanceCopy} from './desktop.mjs';
import {fuseNames,fuseSentinel,readElectronFuses} from '../../scripts/native-package-policy.mjs';

export const sha256=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
export async function setOwnedFuse(copy:AcceptanceCopy,name:string,enabled:boolean){
 assert.equal(path.dirname(copy.executable),path.join(copy.root,'package'));
 assert.ok((await fs.lstat(copy.executable)).isFile());
 const bytes=await fs.readFile(copy.executable),before=readElectronFuses(bytes),index=fuseNames.indexOf(name);
 assert.ok(index>=0,'Unreviewed fuse name');assert.equal(typeof before.values[name],'boolean');
 const originalSha256=sha256(bytes),offset=bytes.indexOf(fuseSentinel)+fuseSentinel.length+2+index;
 bytes[offset]=enabled?0x31:0x30;
 assert.deepEqual(readElectronFuses(bytes).values,{...before.values,[name]:enabled});
 await fs.writeFile(copy.executable,bytes);
 return {before:before.values,originalSha256,changedSha256:sha256(bytes)};
}

export async function ownedProbe(copy:AcceptanceCopy,args:string[],overrides:Record<string,string>={}){
 assert.equal(path.dirname(copy.executable),path.join(copy.root,'package'));
 const env={...process.env};for(const key of ['ELECTRON_RUN_AS_NODE','NODE_OPTIONS','NODE_EXTRA_CA_CERTS','ELECTRON_NO_ASAR','ELECTRON_DEFAULT_ERROR_MODE','NODE_TLS_REJECT_UNAUTHORIZED'])delete env[key];
 Object.assign(env,overrides);
 const child=spawn(copy.executable,args,{cwd:copy.root,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
 let diagnostics='',timer:ReturnType<typeof setTimeout>|undefined;
 for(const stream of [child.stdout,child.stderr])stream.on('data',bytes=>{if(diagnostics.length<16384)diagnostics+=bytes.toString().slice(0,16384-diagnostics.length);});
 try{
  const outcome=await new Promise<{code:number|null;signal:NodeJS.Signals|null}>((resolve,reject)=>{
   child.once('error',()=>reject(Error('Owned fuse probe failed to spawn')));
   child.once('close',(code,signal)=>resolve({code,signal}));
   timer=setTimeout(()=>{child.kill();reject(Error('Owned fuse probe timed out; forced cleanup is not acceptance'));},10000);
  });
  await fs.writeFile(path.join(copy.root,'probe-diagnostics.txt'),diagnostics);
  return {...outcome,diagnostics};
 }finally{if(timer)clearTimeout(timer);}
}

export async function absent(file:string){try{await fs.lstat(file);return false;}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return true;throw error;}}
