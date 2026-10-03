import { expect,it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AuthService } from '../../src/main/auth';

it('rejects forged callback state, prevents a parallel attempt, and closes the listener on cancellation',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'cc-lime-oauth-'));
  let opened!:(value:string)=>void;const browser=new Promise<string>(resolve=>{opened=resolve;});
  const auth=new AuthService({projectId:'demo-cc-lime',apiKey:'synthetic-test-key-not-a-real-key',googleClientId:'synthetic-client.apps.googleusercontent.com'},root,{isEncryptionAvailable:()=>false,encryptString:()=>Buffer.alloc(0),decryptString:()=>''},async url=>{opened(url);});
  try{
    const outcome=auth.google().then(()=>null,error=>error);
    const request=new URL(await browser),callback=new URL(request.searchParams.get('redirect_uri')!);
    expect(callback.hostname).toBe('127.0.0.1');expect(request.searchParams.get('code_challenge_method')).toBe('S256');
    expect(request.searchParams.get('nonce')).toBeTruthy();
    callback.searchParams.set('state','forged-unicode-\u00e9');callback.searchParams.set('code','invalid-test-code');
    expect((await fetch(callback)).status).toBe(400);
    expect(auth.session).toBeNull();
    await expect(auth.google()).rejects.toThrow('already in progress');
    auth.cancelGoogle();expect((await outcome).message).toContain('canceled');
    await expect(fetch(callback)).rejects.toThrow();
  }finally{
    auth.cancelGoogle();
    if(path.dirname(root)!==path.resolve(os.tmpdir())||!path.basename(root).startsWith('cc-lime-oauth-'))throw new Error('Unsafe test cleanup path.');
    fs.rmSync(root,{recursive:true,force:true});
  }
});
