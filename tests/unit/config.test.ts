import { afterEach, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadCloudConfiguration } from '../../src/main/config';
const roots:string[]=[];
afterEach(()=>{for(const root of roots.splice(0))if(root.startsWith(path.join(os.tmpdir(),'cc-lime-env-')))fs.rmSync(root,{recursive:true,force:true});});
function root(){const r=fs.mkdtempSync(path.join(os.tmpdir(),'cc-lime-env-'));roots.push(r);return r;}
it('loads cloud settings only from the local environment file or process environment',()=>{const r=root();fs.mkdirSync(path.join(r,'.local'));fs.writeFileSync(path.join(r,'.local','.env'),'CC_LIME_FIREBASE_PROJECT_ID=demo-cc-lime\nCC_LIME_FIREBASE_API_KEY=synthetic-test-key-not-a-real-key\n');expect(loadCloudConfiguration(r,undefined,{})).toEqual({projectId:'demo-cc-lime',apiKey:'synthetic-test-key-not-a-real-key'});expect(loadCloudConfiguration(r,undefined,{CC_LIME_FIREBASE_API_KEY:'override-test-key-not-a-real-key'})?.apiKey).toBe('override-test-key-not-a-real-key');});
it('never guesses a key from a public client JSON file',()=>{const r=root();fs.writeFileSync(path.join(r,'cloud-client.json'),JSON.stringify({projectId:'demo-cc-lime',apiKey:'old-public-file-not-a-real-key'}));expect(loadCloudConfiguration(r,undefined,{})).toBeNull();});
it('returns a redacted error for incomplete configuration',()=>{const r=root();expect(()=>loadCloudConfiguration(r,undefined,{CC_LIME_FIREBASE_API_KEY:'synthetic-test-key-not-a-real-key'})).toThrow('incomplete');});
