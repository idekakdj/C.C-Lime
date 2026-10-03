// Import the owner's desktop client without logging or bundling credentials.
import fs from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';

const directory = path.resolve('.local');
const filename = path.join(directory, 'google-oauth.json');
const envFile = path.join(directory, '.env');
const desktop = JSON.parse(fs.readFileSync(filename, 'utf8')).installed;
const environment = fs.existsSync(envFile) ? parseEnv(fs.readFileSync(envFile, 'utf8')) : {};
if (!desktop || desktop.project_id !== environment.CC_LIME_FIREBASE_PROJECT_ID
  || !/^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/.test(desktop.client_id ?? '')
  || typeof desktop.client_secret !== 'string' || !desktop.client_secret
  || desktop.auth_uri !== 'https://accounts.google.com/o/oauth2/auth'
  || desktop.token_uri !== 'https://oauth2.googleapis.com/token'
  || !desktop.redirect_uris?.includes('http://localhost')) {
  throw new Error('Expected a Google Desktop app client for the project already configured in .local/.env. No configuration was changed.');
}
environment.CC_LIME_GOOGLE_CLIENT_ID = desktop.client_id;
environment.CC_LIME_GOOGLE_CLIENT_SECRET = desktop.client_secret;
const entries = Object.entries(environment);
if (entries.some(([key, value]) => !/^[A-Z_][A-Z0-9_]*$/.test(key) || /[\r\n'\0]/.test(value))) {
  throw new Error('The local environment contains an unsupported value. No configuration was changed.');
}
fs.writeFileSync(`${envFile}.new`, entries.map(([key, value]) => `${key}='${value}'`).join('\n') + '\n', { mode: 0o600 });
fs.renameSync(`${envFile}.new`, envFile);
console.log('Verified desktop client and imported Google settings into .local/.env. Credential values were not printed.');
