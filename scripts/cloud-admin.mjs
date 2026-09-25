// Owner-only setup helper. Never included in the desktop bundle; never prints credentials.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const auth = require('firebase-tools/lib/auth.js');
const account = auth.getGlobalDefaultAccount();
if (!account) throw new Error('Sign into Firebase CLI first.');
const { access_token } = await auth.getAccessToken(account.tokens.refresh_token, ['https://www.googleapis.com/auth/cloud-platform','https://www.googleapis.com/auth/firebase']);
const project = 'cc-lime-8d41b';
async function request(url, method='GET', body) {
  const response = await fetch(url, { method, headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const result = await response.json();
  if (!response.ok) throw new Error(`${response.status}: ${result.error?.message ?? 'Setup request failed'}`);
  return result;
}
switch (process.argv[2]) {
  case 'auth-config': {
    fs.mkdirSync('.tools', { recursive: true });
    fs.writeFileSync('.tools/firebase-auth.json', JSON.stringify({ auth: { providers: { emailPassword: true, googleSignIn: { oAuthBrandDisplayName: 'C.C. Lime', supportEmail: account.user.email } } } }, null, 2));
    console.log('Prepared owner-only provider configuration.'); break;
  }
  case 'enable': {
    let operation = await request(`https://serviceusage.googleapis.com/v1/projects/${project}/services:batchEnable`, 'POST', { serviceIds: ['firestore.googleapis.com','identitytoolkit.googleapis.com'] });
    for (let i = 0; !operation.done && i < 20; i++) { await new Promise(resolve => setTimeout(resolve, 2000)); operation = await request(`https://serviceusage.googleapis.com/v1/${operation.name}`); }
    if (operation.error) throw new Error(operation.error.message);
    console.log(JSON.stringify({ done: operation.done, services: ['firestore.googleapis.com','identitytoolkit.googleapis.com'] })); break;
  }
  case 'auth': {
    const url = `https://identitytoolkit.googleapis.com/admin/v2/projects/${project}/config`;
    await request(`${url}?updateMask=signIn.email.enabled,signIn.email.passwordRequired`, 'PATCH', { signIn: { email: { enabled: true, passwordRequired: true } } });
    console.log('Email/password authentication enabled.'); break;
  }
  case 'inspect': {
    const result = await request(`https://identitytoolkit.googleapis.com/admin/v2/projects/${project}/config`);
    console.log(JSON.stringify({ signIn: result.signIn, authorizedDomains: result.authorizedDomains, subtype: result.subtype })); break;
  }
  default: throw new Error('Choose enable, auth-config, auth or inspect.');
}
