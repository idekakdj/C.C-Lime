import fs from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';
import { z } from 'zod';
import type { CloudConfiguration } from '../shared/model';

const schema=z.object({projectId:z.string().regex(/^[a-z0-9][a-z0-9-]{4,61}[a-z0-9]$/),apiKey:z.string().min(20).max(256),googleClientId:z.string().endsWith('.apps.googleusercontent.com').optional(),googleClientSecret:z.string().max(1024).optional()});
export function loadCloudConfiguration(userData:string,developmentRoot?:string,environment:NodeJS.ProcessEnv=process.env):CloudConfiguration|null{
  const localFile=path.join(developmentRoot??userData,'.local','.env');
  const file=fs.existsSync(localFile)?parseEnv(fs.readFileSync(localFile,'utf8')):{};
  const setting=(key:string)=>environment[key]??file[key];
  const apiKey=setting('CC_LIME_FIREBASE_API_KEY'),projectId=setting('CC_LIME_FIREBASE_PROJECT_ID');
  if(!apiKey&&!projectId)return null;
  const result=schema.safeParse({apiKey,projectId,googleClientId:setting('CC_LIME_GOOGLE_CLIENT_ID')||undefined,googleClientSecret:setting('CC_LIME_GOOGLE_CLIENT_SECRET')||undefined});
  if(!result.success)throw new Error('The local cloud environment configuration is incomplete. Check the variable names in .env.example.');
  return result.data;
}
