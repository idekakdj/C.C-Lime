import fs from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';
import { z } from 'zod';
import type { CloudConfiguration } from '../shared/model';
import { passkeyOrigin } from './passkey-client';

const schema=z.object({projectId:z.string().regex(/^[a-z0-9][a-z0-9-]{4,61}[a-z0-9]$/),apiKey:z.string().min(20).max(256),googleClientId:z.string().endsWith('.apps.googleusercontent.com').optional(),googleClientSecret:z.string().max(1024).optional()});
export function loadCloudConfiguration(userData:string,developmentRoot?:string,environment:NodeJS.ProcessEnv=process.env):CloudConfiguration|null{
  const localFile=path.join(developmentRoot??userData,'.local','.env');
  const file=fs.existsSync(localFile)?parseEnv(fs.readFileSync(localFile,'utf8')):{};
  const setting=(key:string)=>environment[key]??file[key];
  const apiKey=setting('CC_LIME_FIREBASE_API_KEY'),projectId=setting('CC_LIME_FIREBASE_PROJECT_ID');
  if(!apiKey&&!projectId)return null;
  const result=schema.safeParse({apiKey,projectId,googleClientId:setting('CC_LIME_GOOGLE_CLIENT_ID')||undefined,googleClientSecret:setting('CC_LIME_GOOGLE_CLIENT_SECRET')||undefined});
  if(!result.success)throw new Error('The local cloud environment configuration is incomplete. Check the variable names in .env.example.');
  const totp = setting('CC_LIME_TOTP_ENABLED');
  if (totp && !['true','false'].includes(totp)) throw new Error('CC_LIME_TOTP_ENABLED must be true or false.');
  const origin = setting('CC_LIME_PASSKEY_ORIGIN');
  if (origin) { try { passkeyOrigin(origin); } catch { throw new Error('CC_LIME_PASSKEY_ORIGIN must be an exact trusted HTTPS origin.'); } }
  const required = setting('CC_LIME_MFA_REQUIRED');
  if (required && !['true','false'].includes(required)) throw new Error('CC_LIME_MFA_REQUIRED must be true or false.');
  if (required === 'true' && totp !== 'true' && !origin) throw new Error('Required MFA needs an activated enrollment method.');
  return { ...result.data, ...(totp ? { totpEnabled: totp === 'true' } : {}), ...(origin ? { passkeyOrigin: origin } : {}), ...(required ? { mfaRequired: required === 'true' } : {}) };
}
