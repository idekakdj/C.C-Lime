import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import {rendererCopy} from './desktop.mjs';
import {verifySignInReadiness} from '../../scripts/signin-readiness.mjs';

test('private runtime configuration enables email and Google sign-in on fresh startup and ordinary restart',async({},info)=>{
 const copy=await rendererCopy();
 const environmentBytes=Buffer.from('CC_LIME_FIREBASE_PROJECT_ID=demo-cc-lime\nCC_LIME_FIREBASE_API_KEY=synthetic-readiness-key-not-real\nCC_LIME_GOOGLE_CLIENT_ID=synthetic-readiness.apps.googleusercontent.com\n');
 const report=await verifySignInReadiness({executable:copy.executable,expectedVersion:copy.version,environmentBytes,expectPasskey:false,fileOnly:true,expectedPolicy:copy.policy});
 expect(report.freshAndRestart).toHaveLength(2);expect(report.privateEnvironmentRemoved).toBe(true);
 await fs.writeFile(info.outputPath('summary.json'),JSON.stringify({...report,fixturePolicy:copy.policy},null,2));
});

test('an unconfigured isolated copy keeps authentication disabled instead of pretending to support sign-in',async({},info)=>{
 const copy=await rendererCopy();
 const report=await verifySignInReadiness({executable:copy.executable,expectedVersion:copy.version,expectConfigured:false,expectGoogle:false,expectPasskey:false,fileOnly:true,expectedPolicy:copy.policy});
 expect(report.freshAndRestart).toHaveLength(2);
 await fs.writeFile(info.outputPath('summary.json'),JSON.stringify({...report,fixturePolicy:copy.policy},null,2));
});
