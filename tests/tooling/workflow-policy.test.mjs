import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {inspectWorkflow} from '../../scripts/workflow-policy.mjs';
const pins=JSON.parse(fs.readFileSync('.github/action-pins.json','utf8')).pins;
const workflow=fs.readFileSync('.github/workflows/check.yml','utf8');

test('actual workflow uses verified action commits, read-only tokens and no persisted checkout credentials',()=>{
 const result=inspectWorkflow(workflow,pins);assert.equal(result.approvedRepositories,4);assert.ok(result.references>=4);assert.equal(result.persistedCheckoutCredentials,false);
});
test('floating tags, abbreviated SHAs, unknown actions and changed commits fail policy',()=>{
 for(const replacement of ['actions/checkout@v4','actions/checkout@1234567',`other/checkout@${pins[0].commit}`,`actions/checkout@${'a'.repeat(40)}`])
  assert.throws(()=>inspectWorkflow(workflow.replace(`actions/checkout@${pins[0].commit}`,replacement),pins),/approved|Unreviewed/);
});
test('privileged triggers, token escalation and inherited secrets fail policy',()=>{
 for(const changed of [workflow.replace('[push, pull_request]','[push, pull_request_target]'),workflow.replace('contents: read','contents: write'),workflow.replace('    runs-on:','    permissions: write-all\n    runs-on:'),workflow.replace('    runs-on:','    secrets: inherit\n    runs-on:')])
  assert.throws(()=>inspectWorkflow(changed,pins),/review|escalation|secrets/);
});
test('checkout token persistence and event expressions in shell commands fail policy',()=>{
 assert.throws(()=>inspectWorkflow(workflow.replace('persist-credentials: false','persist-credentials: true'),pins),/persist/);
 assert.throws(()=>inspectWorkflow(workflow.replace('npm ci','echo ${{ github.event.pull_request.title }}'),pins),/interpolation/);
});
test('duplicate keys, aliases and duplicate pin entries cannot bypass workflow policy',()=>{
 assert.throws(()=>inspectWorkflow(`${workflow}\npermissions: write-all\n`,pins),/duplicate/);
 assert.throws(()=>inspectWorkflow(workflow.replace('contents: read','contents: &permission read\n  packages: *permission'),pins));
 assert.throws(()=>inspectWorkflow(workflow,[...pins,pins[0]]),/Duplicate/);
});
test('runner and parser structure changes require review',()=>{
 assert.throws(()=>inspectWorkflow(workflow.replace('runs-on: windows-2022','runs-on: self-hosted'),pins),/compatibility/);
 assert.throws(()=>inspectWorkflow('name: missing steps',pins));
});

test('runtime review, unsafe fork checkout and artifact format changes fail policy',()=>{
 assert.throws(()=>inspectWorkflow(workflow,pins.map((p,i)=>i===0?{...p,runtime:'node20'}:p)),/Node 24/);
 assert.throws(()=>inspectWorkflow(workflow,pins.map((p,i)=>i===0?{...p,tag:'v7'}:p)),/stable release/);
 assert.throws(()=>inspectWorkflow(workflow.replace('allow-unsafe-pr-checkout: false','allow-unsafe-pr-checkout: true'),pins),/Unsafe/);
 assert.throws(()=>inspectWorkflow(workflow.replace('archive: true','archive: false'),pins),/ZIP/);
});

test('combined-hardening CI cannot omit the sign-in readiness regression',()=>{
 assert.throws(()=>inspectWorkflow(workflow.replace('signin-readiness.spec.ts ',''),pins),/sign-in coverage/);
 assert.throws(()=>inspectWorkflow(workflow.replace('frame-boundaries.spec.ts ',''),pins),/frame coverage/);
});
