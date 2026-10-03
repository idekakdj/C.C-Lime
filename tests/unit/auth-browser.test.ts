import {expect,it} from 'vitest';
import {validateAuthenticationBrowserUrl} from '../../src/main/auth-browser';
const origin='https://calendar-auth.example.test',config={projectId:'demo-cc-lime',apiKey:'synthetic-key',passkeyOrigin:origin};
const ticket='A'.repeat(43);
it('allows the native Google authorization address and exact configured passkey ceremony',()=>{
  expect(()=>validateAuthenticationBrowserUrl('https://accounts.google.com/o/oauth2/v2/auth?client_id=synthetic&state=synthetic',config)).not.toThrow();
  expect(()=>validateAuthenticationBrowserUrl(`${origin}/passkeys#${ticket}`,config)).not.toThrow();
});
it('rejects unconfigured passkeys and arbitrary host/path/query/fragment/credential/port substitutions',()=>{
  expect(()=>validateAuthenticationBrowserUrl(`${origin}/passkeys#${ticket}`,null)).toThrow('Unsupported');
  for(const value of [`http://calendar-auth.example.test/passkeys#${ticket}`,`https://evil.example.test/passkeys#${ticket}`,`${origin}/other#${ticket}`,`${origin}/passkeys?next=evil#${ticket}`,`${origin}/passkeys#short`,`https://user:password@calendar-auth.example.test/passkeys#${ticket}`,`https://calendar-auth.example.test:8443/passkeys#${ticket}`,'file:///C:/synthetic','https://accounts.google.com/other','https://accounts.google.com/o/oauth2/v2/auth#redirect'])expect(()=>validateAuthenticationBrowserUrl(value,config)).toThrow();
});
