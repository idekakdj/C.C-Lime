import fs from 'node:fs';
import { parseEnv } from 'node:util';
// Supplement format-based scans with exact locally configured values, without
// printing them. CI still uses signature scans when no private file is present.
export function privateValues(){
  const keys=['CC_LIME_FIREBASE_API_KEY','CC_LIME_GOOGLE_CLIENT_ID','CC_LIME_GOOGLE_CLIENT_SECRET','RATE_LIMIT_SECRET','FIREBASE_SIGNER_EMAIL','FIREBASE_SIGNER_PRIVATE_KEY','PILOT_UIDS'];
  const locals=['.local/.env','.dev.vars','gateway/.dev.vars'].filter(file=>fs.existsSync(file)).map(file=>{
    try{return parseEnv(fs.readFileSync(file,'utf8'));}catch{throw Error('Private configuration could not be parsed for the secret scan. Values not printed.');}
  });
  return [...new Set(keys.flatMap(key=>[...locals.map(local=>local[key]),process.env[key]]).filter(value=>typeof value==='string'&&value.length>8))];
}
