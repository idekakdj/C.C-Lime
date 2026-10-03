import type { CloudConfiguration } from '../shared/model';
// Shell.openExternal stays limited to the two main-owned authentication ceremonies.
export function validateAuthenticationBrowserUrl(value:string,config:CloudConfiguration|null):void {
  const url=new URL(value);
  if(url.protocol!=='https:'||url.username||url.password||url.port)throw Error('Unsupported sign-in address.');
  if(url.hostname==='accounts.google.com'&&url.pathname==='/o/oauth2/v2/auth'&&!url.hash)return;
  if(config?.passkeyOrigin&&url.origin===config.passkeyOrigin&&url.pathname==='/passkeys'&&!url.search&&/^#[A-Za-z0-9_-]{43}$/.test(url.hash))return;
  throw Error('Unsupported sign-in address.');
}
