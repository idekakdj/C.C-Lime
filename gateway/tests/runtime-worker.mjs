// LOCAL TEST ENTRY ONLY. Never deploy this file: identity is synthetic by design.
import { createHandler } from '../src/worker.mjs';
const identity={
  async verify(token){if(token!=='synthetic-verified-totp')throw Error('IDENTITY');return{uid:'alice',authTime:Math.floor(Date.now()/1000),validSince:0,hasTotp:true,hasPassword:true,fullFactor:true};},
  async account(uid){if(uid!=='alice')throw Error('IDENTITY');return{uid,validSince:0,hasTotp:true,hasPassword:true};},
  async issue(uid){if(uid!=='alice')throw Error('IDENTITY');return'synthetic-runtime-token';},
  async publishGate(){},
};
export default{fetch:(request,env)=>createHandler(env,{identity})(request)};
