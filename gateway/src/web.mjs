export const page=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>C.C. Lime passkeys</title><link rel="stylesheet" href="/passkeys.css"><script src="/passkeys.js" defer></script></head><body><main><h1>C.C. Lime</h1><h2>Use your passkey</h2><p>Continue with Windows Hello, your phone or a security key. Your device will ask for your PIN or biometrics.</p><button id="continue">Continue with passkey</button><p id="status" role="status" aria-live="polite"></p><p>Cancel by closing this tab and returning to C.C. Lime.</p></main></body></html>`;
export const styles=`:root{color-scheme:dark;font-family:system-ui;background:#100d17;color:#f1e8ff}body{margin:0;min-height:100vh;display:grid;place-items:center}main{width:min(480px,calc(100% - 64px));padding:24px}h1{color:#c1a2ed}p{line-height:1.6}button{padding:16px 24px;border:0;border-radius:10px;background:#ba97e8;color:#170d26;font:inherit;cursor:pointer}button:disabled{opacity:.6}`;
export const browserScript=`'use strict';
const ticket=location.hash.slice(1);history.replaceState(null,'','/passkeys');
const button=document.getElementById('continue'),status=document.getElementById('status');
const decode=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
const encode=v=>btoa(String.fromCharCode(...new Uint8Array(v))).replace(/\\+/g,'-').replace(/\\//g,'_').replace(/=+$/,'');
async function post(path,body){const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),credentials:'omit',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});const value=await response.json();if(!response.ok)throw Error('This attempt ended. Return to C.C. Lime and start again.');return value;}
button.addEventListener('click',async()=>{button.disabled=true;status.textContent='Waiting for your authenticator…';try{
 if(!/^[A-Za-z0-9_-]{43}$/.test(ticket)||!navigator.credentials||!window.PublicKeyCredential)throw Error('Passkeys are unavailable in this browser.');
 const {operation,options}=await post('/api/options',{ticket});options.challenge=decode(options.challenge);
 let credential;if(operation==='register'){options.user.id=decode(options.user.id);options.excludeCredentials=options.excludeCredentials.map(c=>({...c,id:decode(c.id)}));credential=await navigator.credentials.create({publicKey:options});}else credential=await navigator.credentials.get({publicKey:options});
 if(!credential)throw Error('Passkey canceled.');const r=credential.response;
 const response={id:credential.id,rawId:encode(credential.rawId),type:'public-key',clientExtensionResults:credential.getClientExtensionResults(),response:{clientDataJSON:encode(r.clientDataJSON)}};
 if(credential.authenticatorAttachment)response.authenticatorAttachment=credential.authenticatorAttachment;
 if(operation==='register'){response.response.attestationObject=encode(r.attestationObject);if(r.getTransports)response.response.transports=r.getTransports();}else{response.response.authenticatorData=encode(r.authenticatorData);response.response.signature=encode(r.signature);response.response.userHandle=r.userHandle?encode(r.userHandle):null;}
 const result=await post('/api/finish',{ticket,response});const redirect=new URL(result.redirect);if(redirect.protocol!=='http:'||redirect.hostname!=='127.0.0.1'||redirect.pathname!=='/oauth/callback')throw Error('Invalid app callback.');status.textContent='Verified. Returning to C.C. Lime…';location.assign(redirect.href);
}catch(error){status.textContent=error.name==='NotAllowedError'?'Passkey canceled or unavailable. Return to C.C. Lime to start again.':error.message;}});
`;
