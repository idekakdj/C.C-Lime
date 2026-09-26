import fs from 'node:fs';
import { parseEnv } from 'node:util';
// Supplement format-based scans with exact locally configured values, without
// printing them. CI still uses signature scans when no private file is present.
export function privateValues(){
  const local=fs.existsSync('.local/.env')?parseEnv(fs.readFileSync('.local/.env','utf8')):{};
  const keys=['CC_LIME_FIREBASE_API_KEY','CC_LIME_GOOGLE_CLIENT_ID','CC_LIME_GOOGLE_CLIENT_SECRET'];
  return [...new Set(keys.flatMap(key=>[local[key],process.env[key]]).filter(value=>typeof value==='string'&&value.length>8))];
}
