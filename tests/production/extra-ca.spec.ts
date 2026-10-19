import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import https from 'node:https';
import {acceptanceCopy,startDesktop} from './desktop.mjs';
import {ownedLoopbackCertificate} from './owned-loopback-certificate';
import {ownedProbe,setOwnedFuse} from './fuse-probes';

test('NODE_EXTRA_CA_CERTS trusts an owned loopback certificate only with nodeOptions enabled',async({},info)=>{
 const control=await acceptanceCopy(),restricted=await acceptanceCopy();
 const mutation=await setOwnedFuse(restricted,'nodeOptions',false);expect(mutation.before.nodeOptions).toBe(true);expect(mutation.before.runAsNode).toBe(true);
 const tls=ownedLoopbackCertificate(),server=https.createServer({cert:tls.certificate,key:tls.privateKey},(_request,response)=>response.end('owned TLS response'));
 server.on('tlsClientError',()=>{});
 await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',()=>resolve());});
 const address=server.address();if(!address||typeof address==='string')throw Error('Loopback TLS listener missing');
 try{
  for(const copy of [control,restricted]){
   await fs.writeFile(path.join(copy.root,'owned-ca.pem'),tls.certificate,{flag:'wx'});
   await fs.writeFile(path.join(copy.root,'tls-client.cjs'),`const fs=require('node:fs');const https=require('node:https');const output=process.argv[2];
const request=https.get(${JSON.stringify(`https://127.0.0.1:${address.port}/`)},response=>{let text='';response.on('data',chunk=>text+=chunk);response.on('end',()=>fs.writeFileSync(output,JSON.stringify({trusted:true,text})));});
request.setTimeout(3000,()=>request.destroy(Error('Owned TLS timeout')));request.on('error',error=>fs.writeFileSync(output,JSON.stringify({trusted:false,errorCode:error.code??'TIMEOUT'})));`,{flag:'wx'});
  }
  const run=async(copy:typeof control,label:string,extra:boolean)=>{
   const file=path.join(copy.root,`${label}.json`),env:Record<string,string>={ELECTRON_RUN_AS_NODE:'1'};
   if(extra)env.NODE_EXTRA_CA_CERTS=path.join(copy.root,'owned-ca.pem');
   const result=await ownedProbe(copy,[path.join(copy.root,'tls-client.cjs'),file],env);
   expect(result.code,result.diagnostics).toBe(0);expect(result.signal).toBeNull();return JSON.parse(await fs.readFile(file,'utf8'));
  };
  expect(await run(control,'baseline-untrusted',false)).toEqual({trusted:false,errorCode:'DEPTH_ZERO_SELF_SIGNED_CERT'});
  expect(await run(control,'enabled-trust',true)).toEqual({trusted:true,text:'owned TLS response'});
  expect(await run(restricted,'disabled-trust',true)).toEqual({trusted:false,errorCode:'DEPTH_ZERO_SELF_SIGNED_CERT'});
  for(const copy of [control,restricted]){const desktop=await startDesktop(copy,path.join(copy.root,'calendar-profile'));try{await expect(desktop.page.getByRole('heading',{name:'Your calendar',exact:true})).toBeVisible();}finally{await desktop.close();}}
 }finally{server.closeAllConnections();await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
 await fs.writeFile(info.outputPath('summary.json'),JSON.stringify({version:restricted.version,packageSha256:restricted.packageSha256,
  noExtraCaRejected:true,enabledExtraCaTrusted:true,disabledExtraCaRejected:true,explicitUntrustedCertificateCode:'DEPTH_ZERO_SELF_SIGNED_CERT',
  bothCalendarsNormalExit:true,nodeHarnessNormalExit:true,normalExit:true,nodeCliInspect:false,nodeOptionsDisabledInOwnedCopy:true,otherFusesUnchanged:true,
  scope:'Ephemeral self-signed certificate and loopback-only Node TLS pair with runAsNode enabled. No OS trust-store changes; Chromium/network-service certificate behavior is separate. Installed/retained app unchanged.'},null,2));
});
