import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { z } from 'zod';
import type { CloudConfiguration, Session } from '../shared/model';

export interface SecureStorage { isEncryptionAvailable(): boolean; encryptString(value: string): Buffer; decryptString(value: Buffer): string; }
export class AuthError extends Error { constructor(message: string, readonly code: string) { super(message); } }
const messages: Record<string, string> = {
  EMAIL_EXISTS: 'An account already uses this email. Sign in or reset your password.',
  INVALID_LOGIN_CREDENTIALS: 'The email or password is incorrect.', INVALID_PASSWORD: 'The email or password is incorrect.', EMAIL_NOT_FOUND: 'The email or password is incorrect.',
  USER_DISABLED: 'This account has been disabled.', TOKEN_EXPIRED: 'Please sign in again. Your saved calendar is still on this computer.', INVALID_REFRESH_TOKEN: 'Please sign in again. Your saved calendar is still on this computer.',
  TOO_MANY_ATTEMPTS_TRY_LATER: 'Too many attempts. Please wait before trying again.', OPERATION_NOT_ALLOWED: 'This sign-in method has not been enabled for C.C. Lime yet.',
  CREDENTIAL_TOO_OLD_LOGIN_AGAIN: 'Please sign in again before changing your account.', EMAIL_NOT_VERIFIED: 'Verify your email before syncing your calendar.',
  NEED_CONFIRMATION: 'Sign in with the existing email account, then link Google in Settings.', FEDERATED_USER_ID_ALREADY_LINKED: 'That Google identity is already linked to another account.',
};
const savedSchema = z.object({ projectId: z.string(), refreshToken: z.string().min(1), session: z.object({ uid: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/), email: z.string(), displayName: z.string(), verified: z.boolean(), providers: z.array(z.string()) }) });
export class AuthService {
  session: Session | null = null;
  remembered = false;
  private refreshToken = '';
  private idToken = '';
  private expires = 0;
  private refreshPromise: Promise<string> | null = null;
  private busy = false;
  private generation = 0;
  private cancelOAuth: (() => void) | null = null;
  private readonly filename: string;
  constructor(readonly config: CloudConfiguration | null, directory: string, private secure: SecureStorage, private openBrowser: (url: string) => Promise<void>, private changed: () => void = () => {}, private emulator?: string) {
    if (emulator && !/^http:\/\/127\.0\.0\.1:\d+$/.test(emulator)) throw new Error('Authentication emulators must use loopback.');
    fs.mkdirSync(directory, { recursive: true }); this.filename = path.join(directory, 'session.enc');
  }
  restore(): void {
    if (!this.config || !fs.existsSync(this.filename) || !this.secure.isEncryptionAvailable()) return;
    try {
      const saved = savedSchema.parse(JSON.parse(this.secure.decryptString(fs.readFileSync(this.filename))));
      if (saved.projectId !== this.config.projectId) throw new Error('Different project');
      this.refreshToken = saved.refreshToken; this.session = { ...saved.session, offline: true }; this.remembered = true;
    } catch { this.session = null; this.remembered = false; }
  }
  private persist(): void {
    this.remembered = false;
    if (!this.session || !this.config || !this.secure.isEncryptionAvailable()) return;
    const { offline: _, ...session } = this.session;
    const bytes = this.secure.encryptString(JSON.stringify({ projectId: this.config.projectId, refreshToken: this.refreshToken, session }));
    fs.writeFileSync(`${this.filename}.new`, bytes, { mode: 0o600 }); fs.renameSync(`${this.filename}.new`, this.filename); this.remembered = true;
  }
  private async request(action: string, body: object): Promise<any> {
    if (!this.config) throw new AuthError('Cloud sign-in is not configured in this build.', 'NOT_CONFIGURED');
    const base = this.emulator ? `${this.emulator}/identitytoolkit.googleapis.com` : 'https://identitytoolkit.googleapis.com';
    const response = await fetch(`${base}/v1/accounts:${action}?key=${encodeURIComponent(this.config.apiKey)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(20000) });
    const result = await response.json();
    if (!response.ok || result.needConfirmation) {
      const code = result.needConfirmation ? 'NEED_CONFIRMATION' : String(result.error?.message ?? 'AUTH_FAILED').split(' : ')[0];
      throw new AuthError(messages[code] ?? (code.startsWith('WEAK_PASSWORD') ? 'Use a stronger password with at least six characters.' : 'Sign-in could not be completed. Please try again.'), code);
    }
    return result;
  }
  private async exclusive<T>(operation: () => Promise<T>): Promise<T> {
    if (this.busy) throw new Error('A sign-in operation is already in progress.');
    this.busy = true; try { return await operation(); } finally { this.busy = false; }
  }
  private async accept(result: any, expectedUid?: string): Promise<Session> {
    if (typeof result.idToken !== 'string' || typeof result.refreshToken !== 'string' || typeof result.localId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(result.localId)) throw new Error('The identity service returned an invalid session.');
    if (expectedUid && expectedUid !== result.localId) throw new Error('The identity does not match the signed-in account.');
    const profile = await this.request('lookup', { idToken: result.idToken }); const user = profile.users?.[0];
    if (!user || user.localId !== result.localId) throw new Error('Unable to verify this account.');
    this.idToken = result.idToken; this.refreshToken = result.refreshToken; this.expires = Date.now() + Math.min(3600, Number(result.expiresIn) || 3600) * 1000;
    this.session = { uid: user.localId, email: user.email ?? '', displayName: user.displayName ?? '', verified: user.emailVerified === true, providers: (user.providerUserInfo ?? []).map((p: any) => p.providerId) };
    this.persist(); this.changed(); return this.session;
  }
  async signIn(email: string, password: string): Promise<Session> {
    z.string().email().max(254).parse(email); z.string().min(1).max(4096).parse(password);
    return this.exclusive(async () => this.accept(await this.request('signInWithPassword', { email, password, returnSecureToken: true })));
  }
  async reauthenticate(password:string):Promise<void>{
    const expected=this.session;if(!expected)throw new Error('Sign in first.');z.string().min(1).max(4096).parse(password);
    await this.exclusive(async()=>this.accept(await this.request('signInWithPassword',{email:expected.email,password,returnSecureToken:true}),expected.uid));
  }
  async signUp(email: string, password: string, displayName: string): Promise<Session> {
    z.string().email().max(254).parse(email); z.string().min(6).max(4096).parse(password); z.string().max(100).parse(displayName);
    return this.exclusive(async () => {
      const result = await this.request('signUp', { email, password, returnSecureToken: true });
      if (displayName.trim()) await this.request('update', { idToken: result.idToken, displayName: displayName.trim() });
      return this.accept(result);
    });
  }
  async sendVerification(): Promise<void> { await this.request('sendOobCode', { requestType: 'VERIFY_EMAIL', idToken: await this.token() }); }
  async resetPassword(email: string): Promise<void> {
    z.string().email().max(254).parse(email);
    try { await this.request('sendOobCode', { requestType: 'PASSWORD_RESET', email }); } catch (error) { if (!(error instanceof AuthError && error.code === 'EMAIL_NOT_FOUND')) throw error; }
  }
  async refreshProfile(): Promise<Session> {
    const token = await this.token(true); const result = await this.request('lookup', { idToken: token }); const user = result.users?.[0];
    if (!this.session || user?.localId !== this.session.uid) throw new Error('The account could not be verified.');
    this.session = { ...this.session, verified: user.emailVerified === true, displayName: user.displayName ?? '', providers: (user.providerUserInfo ?? []).map((p: any) => p.providerId), offline: false };
    this.persist(); this.changed(); return this.session;
  }
  async token(force = false): Promise<string> {
    if (!this.session || !this.refreshToken || !this.config) throw new AuthError('Please sign in to sync your calendar.', 'SIGNED_OUT');
    if (!force && this.idToken && this.expires > Date.now() + 60000) return this.idToken;
    if (this.refreshPromise) return this.refreshPromise;
    const generation = this.generation; const expectedUid = this.session.uid;
    this.refreshPromise = (async () => {
      const base = this.emulator ? `${this.emulator}/securetoken.googleapis.com` : 'https://securetoken.googleapis.com';
      const response = await fetch(`${base}/v1/token?key=${encodeURIComponent(this.config!.apiKey)}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: this.refreshToken }), signal: AbortSignal.timeout(20000) });
      const result = await response.json();
      if (generation !== this.generation) throw new AuthError('Account changed.', 'SIGNED_OUT');
      if (!response.ok) {
        const code = result.error?.message ?? 'REFRESH_FAILED';
        if (['TOKEN_EXPIRED','INVALID_REFRESH_TOKEN','USER_DISABLED','USER_NOT_FOUND'].includes(code)) this.signOut();
        throw new AuthError(messages[code] ?? 'Could not reconnect. Your changes remain on this computer.', code);
      }
      if (result.user_id !== expectedUid || typeof result.id_token !== 'string' || typeof result.refresh_token !== 'string') throw new Error('Invalid refreshed identity.');
      this.idToken = result.id_token; this.refreshToken = result.refresh_token; this.expires = Date.now() + Math.min(3600, Number(result.expires_in) || 3600)*1000;
      this.session = { ...this.session!, offline: false }; this.persist(); return this.idToken;
    })().finally(() => { this.refreshPromise = null; });
    return this.refreshPromise;
  }
  signOut(): void { this.generation++; this.cancelGoogle(); this.idToken = ''; this.refreshToken = ''; this.expires = 0; this.session = null; this.remembered = false; if (fs.existsSync(this.filename)) fs.unlinkSync(this.filename); this.changed(); }
  cancelGoogle(): void { this.cancelOAuth?.(); this.cancelOAuth = null; }
  async google(link = false, expectedAccount?:string): Promise<Session> {
    if (!this.config?.googleClientId) throw new AuthError('Google sign-in is awaiting the owner’s desktop OAuth configuration.', 'GOOGLE_NOT_CONFIGURED');
    return this.exclusive(async () => {
      const existingToken = link ? await this.token() : undefined; const existingUid = link ? this.session!.uid : expectedAccount;
      const verifier = randomBytes(48).toString('base64url'), nonce = randomBytes(24).toString('base64url'), state = randomBytes(24).toString('base64url');
      const code = await new Promise<{ code: string; redirect: string }>((resolve, reject) => {
        let finished = false; let redirect = '';
        const server = http.createServer((req, res) => {
          const url = new URL(req.url ?? '/', 'http://127.0.0.1');
          if (req.method !== 'GET' || url.pathname !== '/oauth/callback') { res.writeHead(404); res.end(); return; }
          const receivedState = url.searchParams.get('state') ?? '';
          const receivedBytes = Buffer.from(receivedState), expectedBytes = Buffer.from(state);
          if (receivedBytes.length !== expectedBytes.length || !timingSafeEqual(receivedBytes, expectedBytes)) { res.writeHead(400); res.end('Invalid sign-in state. Return to C.C. Lime and try again.'); return; }
          res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'none'" }); res.end('You can close this page and return to C.C. Lime.');
          if (url.searchParams.get('error') || !url.searchParams.get('code')) finish(new Error('Google sign-in was canceled.'));
          else finish(null, { code: url.searchParams.get('code')!, redirect });
        });
        const finish = (error: Error | null, value?: { code: string; redirect: string }) => { if (finished) return; finished = true; clearTimeout(timer); server.close(); this.cancelOAuth = null; error ? reject(error) : resolve(value!); };
        const timer = setTimeout(() => finish(new Error('Google sign-in timed out. Please try again.')), 300000);
        this.cancelOAuth = () => finish(new Error('Google sign-in canceled.'));
        server.on('error', error => finish(error));
        server.listen(0, '127.0.0.1', () => {
          const address = server.address(); if (!address || typeof address === 'string') return finish(new Error('Could not start sign-in.'));
          redirect = `http://127.0.0.1:${address.port}/oauth/callback`;
          const params = new URLSearchParams({ client_id: this.config!.googleClientId!, redirect_uri: redirect, response_type: 'code', scope: 'openid email profile', state, nonce, code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256', prompt: 'select_account' });
          void this.openBrowser(`https://accounts.google.com/o/oauth2/v2/auth?${params}`).catch(error => finish(error));
        });
      });
      const params = new URLSearchParams({ client_id: this.config!.googleClientId!, grant_type: 'authorization_code', code: code.code, redirect_uri: code.redirect, code_verifier: verifier });
      if (this.config!.googleClientSecret) params.set('client_secret', this.config!.googleClientSecret);
      const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params, signal: AbortSignal.timeout(20000) });
      const result = await response.json(); if (!response.ok || typeof result.id_token !== 'string') throw new Error('Google could not complete sign-in. Please try again.');
      const { payload } = await jwtVerify(result.id_token, createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs')), { issuer: ['https://accounts.google.com','accounts.google.com'], audience: this.config!.googleClientId });
      if (payload.nonce !== nonce || payload.email_verified !== true) throw new Error('The Google identity could not be verified.');
      return this.accept(await this.request('signInWithIdp', { postBody: new URLSearchParams({ id_token: result.id_token, providerId: 'google.com' }).toString(), requestUri: 'http://localhost', returnSecureToken: true, returnIdpCredential: true, ...(existingToken ? { idToken: existingToken } : {}) }), existingUid);
    });
  }
  async linkPassword(password: string): Promise<void> { z.string().min(6).max(4096).parse(password); const result = await this.request('update', { idToken: await this.token(), password, returnSecureToken: true }); await this.accept({ ...result, localId: this.session!.uid }, this.session!.uid); }
  async deleteIdentity(): Promise<void> { await this.request('delete', { idToken: await this.token() }); this.signOut(); }
}
