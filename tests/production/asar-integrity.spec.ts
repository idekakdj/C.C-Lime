import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import {getRawHeader,statFile} from '@electron/asar';
import {acceptanceCopy,startDesktop,type AcceptanceCopy} from './desktop.mjs';
import {inspectAsarIntegrity} from '../../scripts/asar-integrity-policy.mjs';
import {ownedProbe,setOwnedFuse,sha256} from './fuse-probes';

async function mutateArchive(copy:AcceptanceCopy,kind:'header'|'content'){
 const archive=path.join(path.dirname(copy.executable),'resources','app.asar');
 const original=await fs.readFile(archive),bytes=Buffer.from(original),raw=getRawHeader(archive);
 if(kind==='header'){
  // Change only an unused map filename, preserving valid JSON, byte lengths and loaded paths.
  const from=Buffer.from('index.cjs.map'),offset=bytes.indexOf(from);
  expect(offset).toBeGreaterThan(0);expect(offset).toBeLessThan(8+raw.headerSize);
  bytes[offset]='u'.charCodeAt(0);
 }else{
  const entry=statFile(archive,path.join('dist','main','index.cjs'));
  expect('offset' in entry).toBe(true);
  const offset=8+raw.headerSize+Number((entry as {offset:string}).offset);
  // Preserve parseable JavaScript; the positive calendar control must still load the changed file.
  const whitespace=bytes.subarray(offset,offset+200).indexOf(Buffer.from(' '));expect(whitespace).toBeGreaterThanOrEqual(0);
  bytes[offset+whitespace]=0x09;
 }
 expect(sha256(bytes)).not.toBe(sha256(original));await fs.writeFile(archive,bytes);
 return {originalArchiveSha256:sha256(original),changedArchiveSha256:sha256(bytes)};
}

for(const kind of ['header','content'] as const)test(`embedded integrity rejects a ${kind} mutation that the unchanged-fuse calendar control can still load`,async({},info)=>{
 const control=await acceptanceCopy(),protectedCopy=await acceptanceCopy();
 const archive=path.join(path.dirname(protectedCopy.executable),'resources','app.asar');
 expect(inspectAsarIntegrity(await fs.readFile(protectedCopy.executable),archive).headerMatches).toBe(true);
 const fuse=await setOwnedFuse(protectedCopy,'embeddedAsarIntegrityValidation',true);expect(fuse.before.embeddedAsarIntegrityValidation).toBe(false);
 const intact=await startDesktop(protectedCopy,path.join(protectedCopy.root,'intact-profile'));
 try{await expect(intact.page.getByRole('heading',{name:'Your calendar',exact:true})).toBeVisible();}finally{await intact.close();}
 const changes=await mutateArchive(protectedCopy,kind);await mutateArchive(control,kind);
 const working=await startDesktop(control,path.join(control.root,'changed-control'));
 try{await expect(working.page.getByRole('heading',{name:'Your calendar',exact:true})).toBeVisible();}finally{await working.close();}
 const refused=await ownedProbe(protectedCopy,[`--cc-lime-test-profile=${path.join(protectedCopy.root,'refused-profile')}`,'--no-error-dialogs','--enable-logging=stderr']);
 expect(refused.code,refused.diagnostics).not.toBeNull();expect(refused.code,refused.diagnostics).not.toBe(0);expect(refused.signal).toBeNull();
 if(kind==='header'){
  expect(refused.diagnostics).toMatch(/Integrity check failed for asar archive entry/);expect(refused.diagnostics).toContain("'<header>'");
 }else expect(refused.diagnostics).toMatch(/ASAR Integrity Violation: got a hash mismatch \([a-f0-9]{64} vs [a-f0-9]{64}\)/);
 await fs.writeFile(info.outputPath('summary.json'),JSON.stringify({version:protectedCopy.version,packageSha256:protectedCopy.packageSha256,
  mutation:kind,intactProtectedCalendarNormalExit:true,mutatedControlCalendarNormalExit:true,explicitIntegrityRefusal:true,
  refusalExitCode:refused.code,normalExit:true,nodeCliInspect:false,embeddedIntegrityEnabledInOwnedCopy:true,otherFusesUnchanged:true,...changes,
  scope:'Paired owned archive mutation after positive intact start; normalExit refers to calendar controls, negative process terminates with explicit integrity diagnostic. Unpacked native code and replaceable unsigned executable remain outside this gate; installed/retained app unchanged.'},null,2));
});
