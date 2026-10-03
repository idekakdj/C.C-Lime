import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {acceptanceCopy,startDesktop} from './desktop.mjs';
import {absent,ownedProbe,setOwnedFuse} from './fuse-probes';

async function cookieRow(profile:string){
 const filename=path.join(profile,'Network','Cookies');expect(await absent(filename)).toBe(false);
 const database=new DatabaseSync(filename,{readOnly:true});
 try{return database.prepare("SELECT value, encrypted_value FROM cookies WHERE host_key = 'owned.calendar.invalid' AND name = 'owned-cookie'").get() as {value:string;encrypted_value:Uint8Array};}
 finally{database.close();}
}

test('cookie encryption preserves a synthetic existing cookie and OS-encrypted marker while encrypting new writes across restart',async({},info)=>{
 const control=await acceptanceCopy(),encrypted=await acceptanceCopy();
 const mutation=await setOwnedFuse(encrypted,'cookieEncryption',true);expect(mutation.before.cookieEncryption).toBe(false);
 for(const copy of [control,encrypted]){
  const desktop=await startDesktop(copy,path.join(copy.root,'intact-calendar'));
  try{await expect(desktop.page.getByRole('heading',{name:'Your calendar',exact:true})).toBeVisible();}finally{await desktop.close();}
 }
 const before=`owned-plain-${randomUUID()}`,after=`owned-encrypted-${randomUUID()}`,secureMarker=`owned-secure-${randomUUID()}`;
 for(const copy of [control,encrypted]){
  const resources=path.join(path.dirname(copy.executable),'resources'),preserved=path.join(resources,'preserved-app.asar');
  expect(await absent(preserved)).toBe(true);await fs.rename(path.join(resources,'app.asar'),preserved);
  const fallback=path.join(resources,'app');await fs.mkdir(fallback);
  await fs.writeFile(path.join(fallback,'package.json'),JSON.stringify({name:'owned-cookie-probe',version:'0.0.0',main:'main.cjs'}),{flag:'wx'});
  await fs.writeFile(path.join(fallback,'main.cjs'),`const {app,session,safeStorage}=require('electron');const fs=require('node:fs');const path=require('node:path');
const profile=process.argv.find(v=>v.startsWith('--owned-profile=')).slice(16),output=process.argv.find(v=>v.startsWith('--owned-output=')).slice(15),mode=process.argv.find(v=>v.startsWith('--owned-mode=')).slice(13);
app.setPath('userData',profile);app.whenReady().then(async()=>{try{
 const cookies=session.defaultSession.cookies,existing=(await cookies.get({url:'https://owned.calendar.invalid/',name:'owned-cookie'}))[0]?.value??null;
 const secureFile=path.join(profile,'owned-secure-marker.bin');let secureAvailable=safeStorage.isEncryptionAvailable(),secureRestored=null;
 if(!secureAvailable)throw Error('OS encryption unavailable');
 if(fs.existsSync(secureFile))secureRestored=safeStorage.decryptString(fs.readFileSync(secureFile));else fs.writeFileSync(secureFile,safeStorage.encryptString(${JSON.stringify(secureMarker)}));
 if(mode!=='read'){await cookies.set({url:'https://owned.calendar.invalid/',name:'owned-cookie',value:mode==='baseline'?${JSON.stringify(before)}:${JSON.stringify(after)},expirationDate:Date.now()/1000+86400,secure:true,httpOnly:true});await cookies.flushStore();}
 fs.writeFileSync(output,JSON.stringify({existing,secureAvailable,secureRestored}));app.quit();
}catch{app.exit(2);}});`,{flag:'wx'});
 }
 const plainProfile=path.join(control.root,'cookie-profile'),encryptedProfile=path.join(encrypted.root,'cookie-profile');
 const run=async(copy:typeof control,profile:string,mode:string)=>{
  expect(path.dirname(profile)).toBe(copy.root);const output=path.join(copy.root,`cookie-${mode}.json`);
  const result=await ownedProbe(copy,['--no-error-dialogs',`--owned-profile=${profile}`,`--owned-output=${output}`,`--owned-mode=${mode}`]);
  expect(result.code,result.diagnostics).toBe(0);expect(result.signal).toBeNull();return JSON.parse(await fs.readFile(output,'utf8'));
 };
 expect(await run(control,plainProfile,'baseline')).toEqual({existing:null,secureAvailable:true,secureRestored:null});
 const plain=await cookieRow(plainProfile);expect(plain.value).toBe(before);expect(plain.encrypted_value.byteLength).toBe(0);
 await fs.cp(plainProfile,encryptedProfile,{recursive:true,errorOnExist:true,force:false});
 expect(await run(encrypted,encryptedProfile,'migrate')).toEqual({existing:before,secureAvailable:true,secureRestored:secureMarker});
 const saved=await cookieRow(encryptedProfile);expect(saved.value).toBe('');expect(saved.encrypted_value.byteLength).toBeGreaterThan(0);
 expect(Buffer.from(saved.encrypted_value).includes(Buffer.from(after))).toBe(false);
 expect(await run(encrypted,encryptedProfile,'read')).toEqual({existing:after,secureAvailable:true,secureRestored:secureMarker});
 expect((await cookieRow(plainProfile)).value).toBe(before);
 await fs.writeFile(info.outputPath('summary.json'),JSON.stringify({version:encrypted.version,packageSha256:encrypted.packageSha256,
  intactCalendarsNormalExit:true,unencryptedCookieControlProven:true,existingCookiePreserved:true,encryptedWriteValueEmpty:true,
  encryptedBlobPresent:true,plainValueAbsentFromEncryptedBlob:true,encryptedCookieNormalRestart:true,syntheticOsEncryptedMarkerPreserved:true,
  originalProfileUnchanged:true,normalExit:true,nodeCliInspect:false,cookieEncryptionEnabledInOwnedCopy:true,otherFusesUnchanged:true,
  scope:'Synthetic Chromium cookie migration and Windows safeStorage marker only, not a signed-in account/session or owner profile. One-way fuse transition; no rollback of migrated cookie store tested. Installed/retained app unchanged.'},null,2));
});
