import { randomBytes, createHash } from 'node:crypto';
import { z } from 'zod';
import { oauthCallback } from './oauth-callback';
import { authResponse } from './auth-response';
import { ProviderCooldown } from './rate-limit';
export function passkeyOrigin(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.origin !== value || url.username || url.password || url.port || !url.hostname.includes('.') || /^(localhost|127\.|\[)/.test(url.hostname)) throw new Error('Passkeys need an exact, trusted HTTPS origin.');
  return url.origin;
}
const handle = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const launchSchema = z.object({ ticket: handle, url: z.string().max(4096) }).strict();
const authenticated = z.object({ operation: z.literal('authenticated'), uid: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/), customToken: z.string().min(1).max(16384) }).strict();
export class PasskeyClientError extends Error { constructor(readonly status: number) { super('Passkey verification could not be completed. Return to C.C. Lime and start again.'); } }
export class PasskeyClient {
  #origin: string; #abort = new AbortController(); #cancel: (() => void) | null = null; #cooldown = new ProviderCooldown();
  constructor(origin: string, private openBrowser: (url: string) => Promise<void>) { this.#origin = passkeyOrigin(origin); }
  private async post(route: 'start' | 'exchange' | 'credentials' | 'remove' | 'revoke-sessions' | 'session', body: object): Promise<unknown> {
    this.#cooldown.check();
    const response = await fetch(`${this.#origin}/api/${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), redirect: 'error', signal: AbortSignal.any([this.#abort.signal, AbortSignal.timeout(20000)]) });
    this.#cooldown.observe(response); const result = await authResponse(response);
    if (!response.ok) throw new PasskeyClientError(response.status);
    return result;
  }
  async run(operation: 'register' | 'authenticate', idToken?: string, label?: string): Promise<{ operation: 'registered' } | z.infer<typeof authenticated>> {
    const proof = randomBytes(32).toString('base64url'), state = randomBytes(32).toString('base64url');
    let ticket = '';
    const callback = oauthCallback(state, async redirect => {
      const launch = launchSchema.parse(await this.post('start', { operation, proofHash: createHash('sha256').update(proof).digest('base64url'), state, redirect, ...(idToken ? { idToken } : {}), ...(label ? { label } : {}) }));
      if (launch.url !== `${this.#origin}/passkeys#${launch.ticket}`) throw new Error('The passkey service returned an invalid browser address.');
      ticket = launch.ticket; await this.openBrowser(launch.url);
    });
    this.#cancel = callback.cancel;
    try {
      const result = await callback.result;
      handle.parse(result.code);
      const response = await this.post('exchange', { ticket, code: result.code, proof });
      return operation === 'register' ? z.object({ operation: z.literal('registered') }).strict().parse(response) : authenticated.parse(response);
    } finally { this.#cancel = null; this.#abort.abort(); }
  }
  cancel(): void { this.#abort.abort(); this.#cancel?.(); this.#cancel = null; }
  async manage(operation: 'credentials' | 'remove' | 'revoke-sessions' | 'session', idToken: string, credentialId?: string): Promise<unknown> {
    try { return await this.post(operation, { idToken, ...(credentialId ? { credentialId } : {}) }); }
    finally { this.cancel(); }
  }
}
