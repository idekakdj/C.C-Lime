import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {chromium} from '@playwright/test';
import {extractFile} from '@electron/asar';
import {readElectronFuses,hardeningGaps} from './native-package-policy.mjs';
import {inspectAsarIntegrity} from './asar-integrity-policy.mjs';

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function bounded(operation,ms,message){let timer;try{return await Promise.race([operation,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(message)),ms);})]);}finally{clearTimeout(timer);}}
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');

/** Observes fresh actual renderer controls without authenticating or touching an owner profile. */
export async function verifySignInReadiness({executable,expectedVersion,environmentBytes,expectConfigured=true,expectGoogle=true,fileOnly=false,expectedPolicy,outputDirectory='test-results/signin-readiness'}){
 executable=path.resolve(executable);assert.ok((await fs.lstat(executable)).isFile(),'Executable missing');
 const archive=path.join(path.dirname(executable),'resources/app.asar');
 const initialExecutable=digest(await fs.readFile(executable)),initialArchive=digest(await fs.readFile(archive));
 if(expectedPolicy){assert.equal(initialExecutable,expectedPolicy.executableSha256);assert.equal(initialArchive,expectedPolicy.archiveSha256);}
 const manifest=JSON.parse(extractFile(archive,'package.json').toString('utf8'));assert.equal(manifest.version,expectedVersion,'Installed/package version differs');
 const base=path.resolve('test-results');const directory=path.resolve(outputDirectory);assert.ok(directory.startsWith(base+path.sep),'Evidence must remain under ignored test-results');
 await fs.mkdir(directory,{recursive:true});const root=path.join(directory,randomUUID());await fs.mkdir(root);
 const profile=path.join(root,'profile');await fs.mkdir(profile);await fs.writeFile(path.join(profile,'device.json'),JSON.stringify({closeToTray:false}));
 for(const marker of ['quit-explained','tray-explained'])await fs.writeFile(path.join(profile,marker),'1');
 const fixtureEnvironment=path.join(profile,'.local/.env');
 if(environmentBytes!==undefined){await fs.mkdir(path.dirname(fixtureEnvironment));await fs.writeFile(fixtureEnvironment,environmentBytes,{flag:'wx'});}
 const cycles=[];
 async function cycle(){
  const bytes=await fs.readFile(executable);assert.equal(digest(bytes),initialExecutable,'Executable changed before restart');assert.equal(digest(await fs.readFile(archive)),initialArchive,'Archive changed before restart');
  if(expectedPolicy?.mode==='all-seven'){assert.deepEqual(hardeningGaps(readElectronFuses(bytes)),[]);inspectAsarIntegrity(bytes,archive);}
  const env={...process.env};for(const key of ['ELECTRON_RUN_AS_NODE','NODE_OPTIONS','NODE_EXTRA_CA_CERTS','ELECTRON_NO_ASAR'])delete env[key];
  if(fileOnly)for(const key of ['CC_LIME_FIREBASE_API_KEY','CC_LIME_FIREBASE_PROJECT_ID','CC_LIME_GOOGLE_CLIENT_ID','CC_LIME_GOOGLE_CLIENT_SECRET'])delete env[key];
  const child=spawn(executable,[`--cc-lime-test-profile=${profile}`,'--remote-debugging-address=127.0.0.1','--remote-debugging-port=0','--no-error-dialogs'],{cwd:path.dirname(executable),env,windowsHide:true,stdio:['ignore','ignore','pipe']});
  let outcome,stderr='',browser;
  const exit=new Promise(resolve=>{child.once('exit',(code,signal)=>{outcome={code,signal};resolve(outcome);});child.once('error',()=>{outcome={spawnFailed:true};resolve(outcome);});});
  child.stderr.on('data',bytes=>{if(stderr.length<65536)stderr+=bytes.toString().slice(0,65536-stderr.length);});
  try{
   let endpoint;for(let i=0;i<150;i++){endpoint=stderr.match(/DevTools listening on (ws:\/\/127\.0\.0\.1:\d+\/devtools\/browser\/[^\s]+)/)?.[1];if(endpoint||outcome)break;await sleep(100);}
   assert.ok(endpoint,'Renderer transport unavailable');browser=await chromium.connectOverCDP(endpoint,{timeout:10000});
   let page;for(let i=0;i<100;i++){page=browser.contexts()[0].pages().find(p=>p.url().startsWith('cclime://app/'));if(page)break;await sleep(100);}assert.ok(page,'Sign-in renderer unavailable');
   page.setDefaultTimeout(10000);await page.getByRole('button',{name:'Sign in',exact:true}).waitFor();
   const flags=await page.evaluate(async()=>{const s=await window.lime.call('snapshot');return{version:s.version,configured:s.configured,googleConfigured:s.googleConfigured,sessionPresent:!!s.session,localMode:s.localMode,records:s.records.length};});
   assert.deepEqual(flags,{version:expectedVersion,configured:expectConfigured,googleConfigured:expectGoogle,sessionPresent:false,localMode:false,records:0},'Fresh renderer configuration differs');
   assert.equal(await page.getByRole('button',{name:'Sign in',exact:true}).isEnabled(),expectConfigured,'Email sign-in availability differs');
   assert.equal(await page.getByRole('button',{name:/Continue with Google/}).isEnabled(),expectGoogle,'Google sign-in availability differs');
   assert.deepEqual(await page.evaluate(()=>({local:Object.keys(localStorage),session:Object.keys(sessionStorage),node:typeof window.require})),{local:[],session:[],node:'undefined'});
   await page.getByRole('button',{name:'Forgot password?',exact:true}).click();
   assert.equal(await page.getByRole('button',{name:'Send reset link',exact:true}).isEnabled(),expectConfigured,'Reset availability differs');
   await page.getByRole('button',{name:'Back to sign in',exact:true}).click();
   assert.equal(await page.getByRole('button',{name:'Sign in',exact:true}).isEnabled(),expectConfigured);
   const session=await browser.newBrowserCDPSession();await bounded(Promise.race([session.send('Browser.close').catch(()=>{}),exit]),3000,'Ordinary close request timed out.');
   const result=await bounded(exit,10000,'Sign-in fixture did not exit normally');assert.deepEqual(result,{code:0,signal:null},'Normal sign-in fixture exit required');
   cycles.push({...flags,emailControlEnabled:expectConfigured,googleControlEnabled:expectGoogle,resetControlEnabled:expectConfigured,normalExit:true});
  }finally{
   if(!outcome){child.kill();await bounded(exit,5000,'Owned fixture cleanup timed out');}
   if(browser)await bounded(browser.close().catch(()=>{}),3000,'Transport cleanup timed out');
  }
 }
 try{await cycle();await cycle();}
 finally{if(environmentBytes!==undefined){assert.equal(path.dirname(fixtureEnvironment),path.join(profile,'.local'));await fs.unlink(fixtureEnvironment);}}
 const executableBytes=await fs.readFile(executable);
 const report={version:expectedVersion,packageSha256:digest(await fs.readFile(archive)),executableSha256:digest(executableBytes),freshAndRestart:cycles,privateEnvironmentRemoved:true,normalExit:true,nodeCliInspect:readElectronFuses(executableBytes).values.nodeCliInspect,scope:'Fresh configured/missing-config renderer availability and ordinary restart on the supplied executable; no successful authentication, Google consent or owner-profile mutation claimed.'};
 await fs.writeFile(path.join(root,'summary.json'),JSON.stringify(report,null,2));return report;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const args=process.argv.slice(2);assert.equal(args.length,3,'Supply executable, private environment file and expected version');
  const [executable,environmentFile,expectedVersion]=args;assert.equal(path.basename(path.dirname(environmentFile)),'.local','Configuration must be a private .local environment file');
  const report=await verifySignInReadiness({executable,expectedVersion,environmentBytes:await fs.readFile(environmentFile)});
  console.log(JSON.stringify({version:report.version,freshAndRestart:report.freshAndRestart,normalExit:report.normalExit,privateEnvironmentRemoved:report.privateEnvironmentRemoved,scope:report.scope}));
 }catch{console.error('Installed sign-in readiness failed. Check the expected version, physical normal configuration and actual renderer controls; no credential diagnostics are printed.');process.exitCode=1;}
}
