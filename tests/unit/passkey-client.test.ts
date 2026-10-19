import { afterEach, expect, it, vi } from 'vitest';
import { PasskeyClient, passkeyOrigin } from '../../src/main/passkey-client';
const fetchReal = globalThis.fetch;
afterEach(()=>vi.unstubAllGlobals());
it.each(['http://calendar-auth.example.test','https://calendar-auth.example.test/','https://calendar-auth.example.test:8443','https://localhost','https://user:pass@calendar-auth.example.test'])('rejects ambiguous or insecure origin %s',origin=>{
  expect(()=>passkeyOrigin(origin)).toThrow();
});
it('pins both endpoints, state callback and proof before accepting a registration result',async()=>{
  const origin='https://calendar-auth.example.test',ticket='x'.repeat(43),code='y'.repeat(43);let start:any;
  const requests=vi.fn(async(address:string|URL|Request,options?:RequestInit)=>{
    const url=String(address);if(url.startsWith('http://127.0.0.1:'))return fetchReal(address,options);
    expect(options?.redirect).toBe('error');const body=JSON.parse(options!.body as string);
    if(url===origin+'/api/start'){start=body;return new Response(JSON.stringify({ticket,url:`${origin}/passkeys#${ticket}`}));}
    expect(url).toBe(origin+'/api/exchange');expect(body).toEqual({ticket,code,proof:expect.stringMatching(/^[A-Za-z0-9_-]{43}$/)});
    const {createHash}=await import('node:crypto');expect(createHash('sha256').update(body.proof).digest('base64url')).toBe(start.proofHash);
    return new Response(JSON.stringify({operation:'registered'}));
  });vi.stubGlobal('fetch',requests);
  const client=new PasskeyClient(origin,async url=>{expect(url).toBe(`${origin}/passkeys#${ticket}`);const callback=new URL(start.redirect);callback.searchParams.set('state',start.state);callback.searchParams.set('code',code);expect((await fetchReal(callback)).status).toBe(200);});
  await expect(client.run('register','synthetic-id','Test device')).resolves.toEqual({operation:'registered'});expect(start.idToken).toBe('synthetic-id');
  expect(JSON.stringify(client)).not.toContain('synthetic-id');client.cancel();
});
it('does not open a substituted server URL and aborts the suspended browser flow on cancel',async()=>{
  const open=vi.fn(async()=>{});vi.stubGlobal('fetch',async()=>new Response(JSON.stringify({ticket:'x'.repeat(43),url:'https://evil.example.test/passkeys'})));
  const client=new PasskeyClient('https://calendar-auth.example.test',open);
  await expect(client.run('authenticate')).rejects.toThrow('Could not open');expect(open).not.toHaveBeenCalled();client.cancel();
});
