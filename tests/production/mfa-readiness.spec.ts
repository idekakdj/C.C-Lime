import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import {rendererCopy} from './desktop.mjs';
import {verifySignInReadiness} from '../../scripts/signin-readiness.mjs';
test('configured MFA/passkey controls preserve email, Google and reset on fresh startup and restart',async({},info)=>{
  const copy=await rendererCopy();
  const environmentBytes=Buffer.from('CC_LIME_FIREBASE_PROJECT_ID=demo-cc-lime\nCC_LIME_FIREBASE_API_KEY=synthetic-readiness-key-not-real\nCC_LIME_GOOGLE_CLIENT_ID=synthetic-readiness.apps.googleusercontent.com\nCC_LIME_TOTP_ENABLED=true\nCC_LIME_PASSKEY_ORIGIN=https://calendar-auth.example.test\nCC_LIME_MFA_REQUIRED=true\n');
  const report=await verifySignInReadiness({executable:copy.executable,expectedVersion:copy.version,environmentBytes,expectPasskey:true,fileOnly:true,expectedPolicy:copy.policy});
  expect(report.freshAndRestart).toHaveLength(2);expect(report.privateEnvironmentRemoved).toBe(true);
  await fs.writeFile(info.outputPath('summary.json'),JSON.stringify({...report,fixturePolicy:copy.policy,scope:'Packaged source-copy capability controls only; synthetic configuration, no provider/server authentication or owner profile.'},null,2));
});
