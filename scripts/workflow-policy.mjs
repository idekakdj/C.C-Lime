import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {parseDocument} from 'yaml';
const require=createRequire(import.meta.url);
// Existing lockfile build dependency. A parser upgrade requires review, not an implicit policy change.
assert.equal(require('yaml/package.json').version,'2.9.1','Review the workflow parser version');

export function inspectWorkflow(text,pins){
 assert.ok(Array.isArray(pins)&&pins.length>0,'Workflow pin manifest missing');
 const allowed=new Map();
 for(const pin of pins){
  assert.match(pin.repository,/^actions\/[a-z-]+$/);assert.match(pin.commit,/^[a-f0-9]{40}$/);
  assert.equal(pin.runtime,'node24','Action runtime review must target Node 24');
  assert.match(pin.tag,/^v\d+\.\d+\.\d+$/,'Action review must identify a stable release');
  assert.ok(!allowed.has(pin.repository),'Duplicate action pin');allowed.set(pin.repository,pin.commit);
 }
 const document=parseDocument(text,{version:'1.2',uniqueKeys:true});assert.equal(document.errors.length,0,'Malformed or duplicate workflow keys');
 const workflow=document.toJS({maxAliasCount:0});
 assert.deepEqual(workflow.on,['push','pull_request'],'Workflow triggers require security review');
 assert.deepEqual(workflow.permissions,{contents:'read'},'Workflow token permissions require security review');
 assert.ok(workflow.jobs&&Object.keys(workflow.jobs).length>0,'Workflow jobs missing');
 let references=0;
 for(const job of Object.values(workflow.jobs)){
  assert.equal(job['runs-on'],'windows-2022','Runner changes require compatibility review');
  if(job.permissions!==undefined)assert.deepEqual(job.permissions,{contents:'read'},'Job token escalation denied');
  assert.equal(job.secrets,undefined,'Inherited job secrets denied');assert.equal(job.uses,undefined,'Unreviewed reusable workflow denied');
  assert.ok(Array.isArray(job.steps)&&job.steps.length>0,'Workflow steps missing');
  for(const step of job.steps){
   if(step.uses!==undefined){
    assert.equal(typeof step.uses,'string');const match=/^(actions\/[a-z-]+)@([a-f0-9]{40})$/.exec(step.uses);
    assert.ok(match,'Action must use an approved full commit SHA');assert.equal(match[2],allowed.get(match[1]),'Unreviewed action or commit');
    if(match[1]==='actions/checkout'){
     assert.equal(step.with?.['persist-credentials'],false,'Checkout credentials must not persist');
     assert.equal(step.with?.['allow-unsafe-pr-checkout'],false,'Unsafe fork checkout denied');
    }
    if(match[1]==='actions/upload-artifact')assert.equal(step.with?.archive,true,'Evidence must retain ZIP archiving');
    assert.equal(step.run,undefined,'Mixed action/run step denied');references++;
   }
   if(step.run!==undefined){assert.equal(typeof step.run,'string');assert.ok(!step.run.includes('${{'),'Direct expression interpolation in run commands denied');}
   if(step.env?.CC_LIME_ACCEPTANCE_FUSES==='all-seven'){
    assert.ok(step.run?.includes('signin-readiness.spec.ts'),'Combined-hardening sign-in coverage missing');
    assert.ok(step.run?.includes('frame-boundaries.spec.ts'),'Combined-hardening frame coverage missing');
   }
  }
 }
 assert.ok(references>0,'Action references missing');
 return {references,approvedRepositories:allowed.size,tokenPermissions:'contents:read',persistedCheckoutCredentials:false,
  scope:'Static source workflow/pin policy only; not enforced branch protection, administrator MFA or complete action source/native provenance approval.'};
}
