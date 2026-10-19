import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import {acceptanceCopy,startDesktop} from './desktop.mjs';
import {absent,ownedProbe,setOwnedFuse,sha256} from './fuse-probes';

test('runAsNode control executes an owned script while the disabled copy ignores it and preserves normal calendar saves',async({},info)=>{
 const control=await acceptanceCopy(),disabled=await acceptanceCopy();
 const originalControl=sha256(await fs.readFile(control.executable));
 const mutation=await setOwnedFuse(disabled,'runAsNode',false);expect(mutation.before.runAsNode).toBe(true);
 for(const copy of [control,disabled])await fs.writeFile(path.join(copy.root,'owned-script.cjs'),`require('node:fs').writeFileSync(${JSON.stringify(path.join(copy.root,'node-marker.json'))},JSON.stringify({electron:process.versions.electron,nodeMode:true}));`,{flag:'wx'});
 const result=await ownedProbe(control,[path.join(control.root,'owned-script.cjs')],{ELECTRON_RUN_AS_NODE:'1'});
 expect(result.code,result.diagnostics).toBe(0);expect(result.signal).toBeNull();
 expect(JSON.parse(await fs.readFile(path.join(control.root,'node-marker.json'),'utf8'))).toEqual({electron:'44.4.5',nodeMode:true});
 const profile=path.join(disabled.root,'calendar-profile');let desktop=await startDesktop(disabled,profile,undefined,{nodeScript:path.join(disabled.root,'owned-script.cjs')});
 try{
  const page=desktop.page;await expect(page.getByRole('heading',{name:'Your calendar',exact:true})).toBeVisible();
  expect(await absent(path.join(disabled.root,'node-marker.json'))).toBe(true);
  await page.getByRole('button',{name:'Add item',exact:true}).first().click();
  await page.getByRole('dialog').getByLabel('Title',{exact:true}).fill('Node mode disabled durable calendar');
  await page.getByRole('dialog').getByRole('button',{name:'Add to calendar',exact:true}).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await desktop.close();desktop=await startDesktop(disabled,profile);
  await expect(desktop.page.locator('.calendar-event').filter({hasText:'Node mode disabled durable calendar'}).first()).toBeVisible();
 }finally{await desktop.close();}
 expect(await absent(path.join(disabled.root,'node-marker.json'))).toBe(true);
 expect(sha256(await fs.readFile(control.executable))).toBe(originalControl);
 await fs.writeFile(info.outputPath('summary.json'),JSON.stringify({version:disabled.version,packageSha256:disabled.packageSha256,
  enabledNodeScriptExecuted:true,disabledNodeScriptAbsent:true,disabledCalendarRendered:true,saveAndNormalRestart:true,
  normalExit:true,nodeCliInspect:false,runAsNodeDisabledInOwnedCopy:true,otherFusesUnchanged:true,
  originalCopyExecutableSha256:mutation.originalSha256,disabledCopyExecutableSha256:mutation.changedSha256,
  scope:'Paired owned copies with actual Electron Node-mode control and ordinary calendar restart. Worker/native dialog and signed-in migration acceptance remain separate; installed/retained app unchanged.'},null,2));
});
