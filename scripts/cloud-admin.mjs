// Owner-only setup helper. Never included in the desktop bundle; never prints credentials.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import { parseEnv } from 'node:util';
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
  case 'confirm-key-rotation': {
    const old=JSON.parse(fs.readFileSync('cloud/client.json','utf8'));
    const current=parseEnv(fs.readFileSync('.local/.env','utf8'));
    const {keys=[]}=await request(`https://apikeys.googleapis.com/v2/projects/${project}/locations/global/keys?showDeleted=true`);
    let oldKey,newKey;
    for(const key of keys){const value=await request(`https://apikeys.googleapis.com/v2/${key.name}/keyString`);if(value.keyString===old.apiKey)oldKey=key;if(value.keyString===current.CC_LIME_FIREBASE_API_KEY)newKey=key;}
    if(!newKey||newKey.deleteTime||!oldKey?.deleteTime)throw new Error('Could not verify both replacement and old-key deletion.');
    fs.writeFileSync('.local/key-rotation.json',JSON.stringify({rotatedAt:new Date().toISOString(),oldKeyDisabled:true,newKeyName:newKey.name},null,2));
    console.log('Verified: replacement key is active in ignored .local/.env; exposed key has a deletion timestamp. No key values printed.');break;
  }
  case 'rotate-client-key': {
    const old = JSON.parse(fs.readFileSync('cloud/client.json','utf8'));
    const { keys = [] } = await request(`https://apikeys.googleapis.com/v2/projects/${project}/locations/global/keys`);
    let oldName;
    for (const key of keys) { const result = await request(`https://apikeys.googleapis.com/v2/${key.name}/keyString`); if (result.keyString === old.apiKey) oldName = key.name; }
    if (!oldName) throw new Error('The previously configured key was not found; no key was changed.');
    let operation = await request(`https://apikeys.googleapis.com/v2/projects/${project}/locations/global/keys`, 'POST', { displayName:'CC Lime desktop auth - local environment', restrictions:{apiTargets:[{service:'identitytoolkit.googleapis.com'},{service:'securetoken.googleapis.com'}]} });
    for(let i=0;!operation.done&&i<25;i++){await new Promise(resolve=>setTimeout(resolve,2000));operation=await request(`https://apikeys.googleapis.com/v2/${operation.name}`);}
    if(operation.error||!operation.done)throw new Error(operation.error?.message??'Key creation is still pending.');
    const next=operation.response;
    const keyString=next.keyString??(await request(`https://apikeys.googleapis.com/v2/${next.name}/keyString`)).keyString;
    if(typeof keyString!=='string')throw new Error('The key service returned no client key.');
    fs.mkdirSync('.local',{recursive:true});
    fs.writeFileSync('.local/.env',`CC_LIME_FIREBASE_PROJECT_ID=${project}\nCC_LIME_FIREBASE_API_KEY=${keyString}\nCC_LIME_GOOGLE_CLIENT_ID=\nCC_LIME_GOOGLE_CLIENT_SECRET=\n`,{mode:0o600});
    let deletion=await request(`https://apikeys.googleapis.com/v2/${oldName}`, 'DELETE');
    for(let i=0;!deletion.done&&i<25;i++){await new Promise(resolve=>setTimeout(resolve,2000));deletion=await request(`https://apikeys.googleapis.com/v2/${deletion.name}`);}
    const oldStatus = await request(`https://apikeys.googleapis.com/v2/${oldName}`);
    if(!oldStatus.deleteTime)throw new Error('The replacement is saved locally, but disabling the old key was not confirmed.');
    fs.writeFileSync('.local/key-rotation.json',JSON.stringify({rotatedAt:new Date().toISOString(),oldKeyDisabled:true,newKeyName:next.name},null,2));
    console.log('Replacement saved in ignored .local/.env. The exposed key is disabled. The new key is restricted to Authentication APIs.');break;
  }
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
  default: throw new Error('Choose enable, auth or inspect.');
}
