import fs from 'node:fs';
import path from 'node:path';
import { randomBytes, createHash } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { z } from 'zod';
import type { CloudConfiguration, Session } from '../shared/model';
import { ProviderCooldown, retryAfterMs } from './rate-limit';
import { newPasswordSchema } from '../shared/password';
import { oauthCallback } from './oauth-callback';
import { authResponse } from './auth-response';
import { MfaSignInAttempt, type MfaChallengeView } from './mfa-sign-in';
import { TotpEnrollment, type TotpSetup } from './totp-enrollment';
import { performance } from 'node:perf_hooks';
import QRCode from 'qrcode';
import { PasskeyClient, PasskeyClientError } from './passkey-client';

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
const savedSchema = z.object({ projectId: z.string(), refreshToken: z.string().min(1), session: z.object({ uid: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/), email: z.string(), displayName: z.string(), verified: z.boolean(), providers: z.array(z.string()), createdAt:z.string().datetime().optional(), passkeyUntil:z.number().int().positive().optional(),assurance:z.enum(['totp','passkey','google']).optional() }) });
function accountCreatedAt(value:unknown):string|undefined{const milliseconds=typeof value==='string'&&/^\d{1,16}$/.test(value)?Number(value):NaN;return Number.isFinite(milliseconds)&&milliseconds>0&&milliseconds<=Date.now()?new Date(milliseconds).toISOString():undefined;}
export class AuthService {
  private readonly providerCooldown = new ProviderCooldown();
  session: Session | null = null;
  signInNotice: string | null = null;
  remembered = false;
  private refreshToken = '';
  private idToken = '';
  private expires = 0;
  private refreshPromise: Promise<string> | null = null;
  private busy = false;
  private generation = 0;
  private cancelOAuth: (() => void) | null = null;
  #mfa: { attempt: MfaSignInAttempt; resolve: (value: any) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout>; generation: number } | null = null;
  #enrollment: TotpEnrollment | null = null;
  #enrollmentGeneration = 0;
  #recentAuthentication = -Infinity;
  #factorLabels: Array<{ kind: 'totp' | 'phone'; label: string }> = [];
  #passkey: PasskeyClient | null = null;
  private readonly filename: string;
  constructor(readonly config: CloudConfiguration | null, directory: string, private secure: SecureStorage, private openBrowser: (url: string) => Promise<void>, private changed: () => void = () => {}, private emulator?: string) {
    if (emulator && !/^http:\/\/127\.0\.0\.1:\d+$/.test(emulator)) throw new Error('Authentication emulators must use loopback.');
    fs.mkdirSync(directory, { recursive: true }); this.filename = path.join(directory, 'session.enc');
  }
  restore(): void {
    if (fs.existsSync(`${this.filename}.signed-out`)) {
      try { for (const file of [this.filename, `${this.filename}.new`, `${this.filename}.signed-out`]) fs.rmSync(file, { force: true }); } catch { /* Keep sign-out intent until removal succeeds. */ }
      return;
    }
    try { fs.rmSync(`${this.filename}.new`, { force: true }); } catch { /* Never adopt an incomplete replacement. */ }
    if (!this.config || !fs.existsSync(this.filename) || !this.secure.isEncryptionAvailable()) return;
    try {
      const saved = savedSchema.parse(JSON.parse(this.secure.decryptString(fs.readFileSync(this.filename))));
      if (saved.projectId !== this.config.projectId) throw new Error('Different project');
      if (this.config.mfaRequired && !saved.session.assurance) { this.signInNotice = 'Sign in again to set up account security. Your calendar is still on this computer.'; return; }
      if (saved.session.assurance === 'passkey' && (!saved.session.passkeyUntil || !this.config.passkeyOrigin)) throw new Error('Incomplete passkey session');
      if (saved.session.passkeyUntil && saved.session.passkeyUntil <= Math.floor(Date.now()/1000)) {
        this.signOut('Your passkey session expired. Use your passkey to sign in again.'); return;
      }
      this.refreshToken = saved.refreshToken; this.session = { ...saved.session, offline: true }; this.remembered = true;
    } catch { this.session = null; this.remembered = false; }
  }
  private persist(): void {
    this.remembered = false;
    if (this.session?.enrollmentRequired) {
      // A downgrade to enrollment-only must not leave an older full session restorable.
      fs.writeFileSync(`${this.filename}.signed-out`, '1', { mode: 0o600 });
      for (const file of [this.filename, `${this.filename}.new`]) fs.rmSync(file, { force: true });
      return;
    }
    if (!this.session || !this.config || this.session.enrollmentRequired || !this.secure.isEncryptionAvailable()) return;
    const { offline: _, ...session } = this.session;
    const bytes = this.secure.encryptString(JSON.stringify({ projectId: this.config.projectId, refreshToken: this.refreshToken, session }));
    try {
      fs.writeFileSync(`${this.filename}.new`, bytes, { mode: 0o600 }); fs.renameSync(`${this.filename}.new`, this.filename);
      fs.rmSync(`${this.filename}.signed-out`, { force: true }); this.remembered = true;
    } catch {
      try { fs.rmSync(`${this.filename}.new`, { force: true }); } catch { /* Retried on restore/sign-out. */ }
      throw new AuthError('Your sign-in could not be saved on this computer. Check its storage permissions and try again.', 'SESSION_STORAGE_FAILED');
    }
  }
  private async request(action: string, body: object): Promise<any> {
    if (!this.config) throw new AuthError('Cloud sign-in is not configured in this build.', 'NOT_CONFIGURED');
    const generation = this.generation;
    this.providerCooldown.check();
    const base = this.emulator ? `${this.emulator}/identitytoolkit.googleapis.com` : 'https://identitytoolkit.googleapis.com';
    const response = await fetch(`${base}/v1/accounts:${action}?key=${encodeURIComponent(this.config.apiKey)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(20000) });
    this.providerCooldown.observe(response);
    const result = await authResponse(response);
    if (generation !== this.generation) throw new AuthError('Account changed or sign-in canceled. Please sign in again.', 'SIGNED_OUT');
    if (!response.ok || result.needConfirmation) {
      const code = result.needConfirmation ? 'NEED_CONFIRMATION' : String(result.error?.message ?? 'AUTH_FAILED').split(' : ')[0];
      if (code === 'TOO_MANY_ATTEMPTS_TRY_LATER') this.providerCooldown.pause(retryAfterMs(response.headers));
      throw new AuthError(messages[code] ?? (code.startsWith('WEAK_PASSWORD') || code === 'PASSWORD_DOES_NOT_MEET_REQUIREMENTS' ? 'Use a unique password of 8–128 characters that meets the account password policy.' : 'Sign-in could not be completed. Please try again.'), code);
    }
    if (['signInWithPassword', 'signInWithIdp'].includes(action) && result.mfaPendingCredential) return this.challenge(result);
    return result;
  }
  private async mfaRequest(resource: 'mfaSignIn' | 'mfaEnrollment', action: 'start' | 'finalize', body: object, signal: AbortSignal): Promise<unknown> {
    if (!this.config) throw new AuthError('Cloud sign-in is not configured in this build.', 'NOT_CONFIGURED');
    this.providerCooldown.check();
    const base = this.emulator ? `${this.emulator}/identitytoolkit.googleapis.com` : 'https://identitytoolkit.googleapis.com';
    const response = await fetch(`${base}/v2/accounts/${resource}:${action}?key=${encodeURIComponent(this.config.apiKey)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]),
    });
    this.providerCooldown.observe(response); const result = await authResponse(response);
    if (!response.ok) throw new AuthError('Authenticator verification failed. Check your code, device clock and connection, or start again.', 'MFA_FAILED');
    return result;
  }
  get mfaChallenge(): MfaChallengeView | null {
    try { return this.#mfa?.attempt.view() ?? null; } catch { this.cancelMfa(); return null; }
  }
  get security(): { totpAvailable: boolean; passkeyAvailable: boolean; factors: Array<{ kind: 'totp' | 'phone'; label: string }> } {
    return { totpAvailable: this.config?.totpEnabled === true, passkeyAvailable: !!this.config?.passkeyOrigin, factors: this.#factorLabels.map(f => ({ ...f })) };
  }
  private updateFactors(user: any): void {
    this.#factorLabels = (Array.isArray(user.mfaInfo) ? user.mfaInfo : []).slice(0,5).flatMap((f: any) => f?.totpInfo ? [{ kind: 'totp' as const, label: typeof f.displayName === 'string' ? f.displayName.slice(0,60) : 'Authenticator app' }] : f?.phoneInfo ? [{ kind: 'phone' as const, label: 'Text message (deferred)' }] : []);
  }
  private challenge(response: unknown): Promise<any> {
    this.cancelMfa(); const generation = this.generation;
    const attempt = new MfaSignInAttempt(response, (action, body, signal) => this.mfaRequest('mfaSignIn', action, body, signal));
    // SMS remains deferred while billing is disabled. Never request a billable code.
    if (!attempt.view().factors.some(f => f.kind === 'totp')) { attempt.cancel(); throw new AuthError('This account needs a supported authenticator sign-in method.', 'MFA_UNSUPPORTED'); }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.cancelMfa(), 300000); timer.unref();
      this.#mfa = { attempt, resolve, reject, timer, generation }; this.changed();
    });
  }
  async verifyMfa(handle: string, factor: string, code: string): Promise<void> {
    const pending = this.#mfa;
    if (!pending || pending.generation !== this.generation) throw new Error('This sign-in attempt ended. Sign in again.');
    const selected = pending.attempt.view().factors.find(f => f.handle === factor);
    if (selected?.kind !== 'totp') throw new Error('Choose an authenticator-app factor. SMS is not enabled.');
    const result = await pending.attempt.verify(handle, factor, code);
    try {
      // Provider signature and MFA claim must match this app's exact project.
      const { payload } = await jwtVerify(result.idToken, createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')),
        { issuer: `https://securetoken.google.com/${this.config!.projectId}`, audience: this.config!.projectId, algorithms: ['RS256'] });
      const firebase = payload.firebase as { sign_in_second_factor?: string } | undefined;
      if (!payload.sub || !/^[A-Za-z0-9_-]{1,128}$/.test(payload.sub) || firebase?.sign_in_second_factor !== 'totp') throw new Error('The verified session did not include the required authenticator factor.');
      if (pending !== this.#mfa || pending.generation !== this.generation) throw new Error('This sign-in attempt ended. Sign in again.');
      clearTimeout(pending.timer); this.#mfa = null;
      pending.resolve({ ...result, localId: payload.sub }); this.changed();
    } catch {
      this.cancelMfa(); throw new Error('The authenticator session could not be verified. Sign in again.');
    }
  }
  cancelMfa(): void {
    const pending = this.#mfa; this.#mfa = null;
    if (pending) { pending.attempt.cancel(); clearTimeout(pending.timer); pending.reject(new AuthError('Authenticator sign-in canceled or expired. Sign in again.', 'MFA_ENDED')); this.changed(); }
  }
  cancelAuthentication(): void { this.generation++; this.cancelGoogle(); this.cancelMfa(); this.cancelEnrollment(); this.#passkey?.cancel(); this.#passkey = null; }
  private async passkeyClaims(idToken: string, expectedUid: string): Promise<number> {
    const { payload } = await jwtVerify(idToken, createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')),
      { issuer: `https://securetoken.google.com/${this.config!.projectId}`, audience: this.config!.projectId, algorithms: ['RS256'] });
    const provider = (payload.firebase as any)?.sign_in_provider, assurance = payload.cc_lime_passkey as any, now = Math.floor(Date.now()/1000);
    if (payload.sub !== expectedUid || payload.email_verified !== true || provider !== 'custom' || assurance?.v !== 1 || !Number.isSafeInteger(payload.auth_time) || (payload.auth_time as number) > now+10 || !Number.isSafeInteger(assurance.until) || assurance.until <= now || assurance.until > (payload.auth_time as number)+3600 || !Number.isSafeInteger(assurance.epoch) || assurance.epoch < 0 || !Number.isSafeInteger(assurance.valid_since) || assurance.valid_since < 0) throw new Error('The passkey session could not be verified.');
    return assurance.until;
  }
  async passkeySignIn(expectedUid?: string): Promise<Session> {
    if (!this.config?.passkeyOrigin) throw new Error('Passkey sign-in is awaiting trusted server configuration.');
    return this.exclusive(async () => {
      const generation = this.generation, client = new PasskeyClient(this.config!.passkeyOrigin!, this.openBrowser); this.#passkey = client;
      try {
        const response = await client.run('authenticate');
        if (response.operation !== 'authenticated' || generation !== this.generation) throw new Error('Passkey sign-in ended.');
        if (expectedUid && response.uid !== expectedUid) throw new Error('The passkey does not match this account.');
        const result = await this.request('signInWithCustomToken', { token: response.customToken, returnSecureToken: true });
        const until = await this.passkeyClaims(result.idToken, response.uid);
        return this.accept(result, response.uid, generation, until);
      } finally { client.cancel(); if (this.#passkey === client) this.#passkey = null; }
    });
  }
  async registerPasskey(label: string): Promise<void> {
    z.string().trim().min(1).max(60).parse(label);
    if (!this.config?.passkeyOrigin) throw new Error('Passkeys are awaiting trusted server configuration.');
    await this.exclusive(async () => {
      const account = this.session, generation = this.generation;
      if (!account?.verified || performance.now()-this.#recentAuthentication>300000) throw new Error('Confirm your online account before adding a passkey.');
      if (account.providers.includes('password') && !this.#factorLabels.some(f=>f.kind==='totp')) throw new Error('Enroll an authenticator app before adding a passkey to an email/password account.');
      const client = new PasskeyClient(this.config!.passkeyOrigin!, this.openBrowser); this.#passkey = client;
      try {
        await client.run('register', await this.token(true, true), label);
        if (generation !== this.generation || account.uid !== this.session?.uid) throw new Error('Account changed. Check your passkeys after signing in again.');
      } finally { client.cancel(); if (this.#passkey === client) this.#passkey = null; }
    });
  }
  async managePasskeys(operation: 'credentials' | 'remove', credentialId?: string): Promise<unknown> {
    if (!this.config?.passkeyOrigin) throw new Error('Passkeys are awaiting trusted server configuration.');
    return this.exclusive(async () => {
      const account = this.session, generation = this.generation;
      if (!account?.verified || performance.now()-this.#recentAuthentication>300000) throw new Error('Confirm your account before managing passkeys.');
      const client = new PasskeyClient(this.config!.passkeyOrigin!, this.openBrowser); this.#passkey = client;
      try {
        const result = await client.manage(operation, await this.token(true), credentialId);
        if (generation !== this.generation || account.uid !== this.session?.uid) throw new Error('Account changed. Sign in again.');
        if (operation === 'remove') { z.object({done:z.literal(true)}).strict().parse(result); this.signOut('Passkey removed. Sign in again with a remaining authenticator or passkey.'); return true; }
        return z.object({ credentials:z.array(z.object({id:z.string().regex(/^[A-Za-z0-9_-]{1,2048}$/),label:z.string().max(60),createdAt:z.number().int().positive(),lastUsedAt:z.number().int().positive().nullable()}).strict()).max(5) }).strict().parse(result);
      } finally { client.cancel(); if (this.#passkey === client) this.#passkey = null; }
    });
  }
  async startEnrollment(): Promise<TotpSetup & { qr: string }> {
    if (!this.config?.totpEnabled) throw new Error('Authenticator enrollment is awaiting provider activation.');
    return this.exclusive(async () => {
      const account = this.session, generation = this.generation;
      if (!account?.verified || account.offline) throw new Error('Sign in online and verify your email first.');
      if (account.passkeyUntil) throw new Error('Confirm with your password and authenticator, or Google, before adding a native authenticator.');
      if (performance.now() - this.#recentAuthentication > 300000) throw new Error('Confirm your password or Google sign-in before adding an authenticator.');
      this.cancelEnrollment(); const enrollmentGeneration = this.#enrollmentGeneration; const token = await this.token(true, true);
      const started = await TotpEnrollment.start(account.uid, account.email, token, (action, body, signal) => this.mfaRequest('mfaEnrollment', action, body, signal));
      if (generation !== this.generation || enrollmentGeneration !== this.#enrollmentGeneration || account.uid !== this.session?.uid) { started.attempt.cancel(); throw new Error('Account changed or setup canceled. Start setup again.'); }
      this.#enrollment = started.attempt;
      try {
        const qr = await QRCode.toDataURL(started.setup.uri, { errorCorrectionLevel: 'M', width: 256, margin: 2 });
        if (generation !== this.generation || this.#enrollment !== started.attempt) throw new Error('Authenticator setup ended.');
        return { ...started.setup, qr };
      } catch (error) { this.cancelEnrollment(); throw error; }
    });
  }
  async finishEnrollment(handle: string, code: string, name: string): Promise<void> {
    await this.exclusive(async () => {
      const attempt = this.#enrollment, generation = this.generation;
      if (!attempt || attempt.uid !== this.session?.uid) throw new Error('Authenticator setup ended. Start again.');
      const result = await attempt.finish(handle, code, name);
      try {
        const profile = await this.request('lookup', { idToken: result.idToken });
        if (generation !== this.generation || attempt !== this.#enrollment || profile.users?.[0]?.localId !== attempt.uid) throw new Error('Account changed. Sign in again to check your factors.');
      } finally {
        // Successful enrollment changes provider security state even if lookup
        // loses its connection. Discard both old and replacement credentials.
        if (generation === this.generation && this.session?.uid === attempt.uid) this.signOut('Authenticator added. Sign in again with your password and authenticator code.');
      }
    });
  }
  cancelEnrollment(): void { this.#enrollmentGeneration++; this.#enrollment?.cancel(); this.#enrollment = null; }
  private async exclusive<T>(operation: () => Promise<T>): Promise<T> {
    if (this.busy) throw new Error('A sign-in operation is already in progress.');
    this.busy = true; try { return await operation(); } finally { this.busy = false; }
  }
  private async accept(result: any, expectedUid?: string, generation = this.generation, passkeyUntil?: number): Promise<Session> {
    if (typeof result.idToken !== 'string' || typeof result.refreshToken !== 'string' || typeof result.localId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(result.localId)) throw new Error('The identity service returned an invalid session.');
    if (expectedUid && expectedUid !== result.localId) throw new Error('The identity does not match the signed-in account.');
    const profile = await this.request('lookup', { idToken: result.idToken }); const user = profile.users?.[0];
    if (generation !== this.generation) throw new AuthError('Account changed. Please sign in again.', 'SIGNED_OUT');
    if (!user || user.localId !== result.localId) throw new Error('Unable to verify this account.');
    let assurance: Session['assurance'];
    if (this.config?.mfaRequired) {
      const { payload } = await jwtVerify(result.idToken, createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')),
        { issuer: `https://securetoken.google.com/${this.config.projectId}`, audience: this.config.projectId, algorithms: ['RS256'] });
      if (payload.sub !== user.localId || generation !== this.generation) throw new Error('The account security proof does not match this sign-in.');
      const firebase = payload.firebase as any;
      if (firebase?.sign_in_provider === 'google.com') assurance = 'google';
      else if (firebase?.sign_in_provider === 'password' && firebase.sign_in_second_factor === 'totp') assurance = 'totp';
      else if (firebase?.sign_in_provider === 'custom') { await this.passkeyClaims(result.idToken, user.localId); assurance = 'passkey'; }
      else if (firebase?.sign_in_provider !== 'password') throw new Error('This account needs a supported sign-in method.');
      if (generation !== this.generation) throw new Error('Account changed. Sign in again.');
    }
    this.idToken = result.idToken; this.refreshToken = result.refreshToken; this.expires = Date.now() + Math.min(3600, Number(result.expiresIn) || 3600) * 1000;
    this.session = { uid: user.localId, email: user.email ?? '', displayName: user.displayName ?? '', verified: user.emailVerified === true, providers: (user.providerUserInfo ?? []).map((p: any) => p.providerId), createdAt:accountCreatedAt(user.createdAt) };
    if (passkeyUntil) this.session.passkeyUntil = passkeyUntil;
    if (this.config?.mfaRequired) this.session = { ...this.session, ...(assurance ? { assurance } : { enrollmentRequired: true }) };
    this.#recentAuthentication = performance.now();
    this.updateFactors(user);
    this.signInNotice = null; this.persist(); this.changed(); return this.session;
  }
  async signIn(email: string, password: string): Promise<Session> {
    z.string().email().max(254).parse(email); z.string().min(1).max(4096).parse(password);
    return this.exclusive(async () => {const generation=this.generation;return this.accept(await this.request('signInWithPassword', { email, password, returnSecureToken: true }),undefined,generation);});
  }
  async reauthenticate(password:string):Promise<void>{
    const expected=this.session;if(!expected)throw new Error('Sign in first.');z.string().min(1).max(4096).parse(password);
    await this.exclusive(async()=>{const generation=this.generation;return this.accept(await this.request('signInWithPassword',{email:expected.email,password,returnSecureToken:true}),expected.uid,generation);});
  }
  async signUp(email: string, password: string, displayName: string): Promise<Session> {
    z.string().email().max(254).parse(email); newPasswordSchema.parse(password); z.string().max(100).parse(displayName);
    return this.exclusive(async () => {
      const generation=this.generation;
      const result = await this.request('signUp', { email, password, returnSecureToken: true });
      if (displayName.trim()) await this.request('update', { idToken: result.idToken, displayName: displayName.trim() });
      return this.accept(result,undefined,generation);
    });
  }
  async sendVerification(): Promise<void> { await this.request('sendOobCode', { requestType: 'VERIFY_EMAIL', idToken: await this.token(false, true) }); }
  async resetPassword(email: string): Promise<void> {
    z.string().email().max(254).parse(email);
    try { await this.request('sendOobCode', { requestType: 'PASSWORD_RESET', email }); } catch (error) { if (!(error instanceof AuthError && error.code === 'EMAIL_NOT_FOUND')) throw error; }
  }
  async refreshProfile(): Promise<Session> {
    const token = await this.token(true, true); const result = await this.request('lookup', { idToken: token }); const user = result.users?.[0];
    if (!this.session || user?.localId !== this.session.uid) throw new Error('The account could not be verified.');
    this.session = { ...this.session, verified: user.emailVerified === true, displayName: user.displayName ?? '', providers: (user.providerUserInfo ?? []).map((p: any) => p.providerId), createdAt:accountCreatedAt(user.createdAt)??this.session.createdAt, offline: false };
    this.updateFactors(user);
    this.persist(); this.changed(); return this.session;
  }
  async token(force = false, enrollment = false): Promise<string> {
    if (!this.session || !this.refreshToken || !this.config) throw new AuthError('Please sign in to sync your calendar.', 'SIGNED_OUT');
    if (this.session.enrollmentRequired && !enrollment) throw new AuthError('Set up an authenticator or passkey before opening your account calendar.', 'MFA_REQUIRED');
    if (this.session.passkeyUntil && this.session.passkeyUntil <= Math.floor(Date.now()/1000)) { this.signOut('Your passkey session expired. Use your passkey to sign in again.'); throw new AuthError('Sign in again with your passkey.', 'TOKEN_EXPIRED'); }
    if (!force && this.idToken && this.expires > Date.now() + 60000) return this.idToken;
    if (this.refreshPromise) return this.refreshPromise;
    const generation = this.generation; const expectedUid = this.session.uid;
    this.refreshPromise = (async () => {
      this.providerCooldown.check();
      const base = this.emulator ? `${this.emulator}/securetoken.googleapis.com` : 'https://securetoken.googleapis.com';
      const response = await fetch(`${base}/v1/token?key=${encodeURIComponent(this.config!.apiKey)}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: this.refreshToken }), signal: AbortSignal.timeout(20000) });
      this.providerCooldown.observe(response);
      const result = await response.json();
      if (generation !== this.generation) throw new AuthError('Account changed.', 'SIGNED_OUT');
      if (!response.ok) {
        const code = result.error?.message ?? 'REFRESH_FAILED';
        if (code === 'TOO_MANY_ATTEMPTS_TRY_LATER') this.providerCooldown.pause(retryAfterMs(response.headers));
        if (['TOKEN_EXPIRED','INVALID_REFRESH_TOKEN','USER_DISABLED','USER_NOT_FOUND'].includes(code)) this.signOut('Your session has ended. Sign in again to open your calendar. Your saved changes are still on this computer.');
        throw new AuthError(messages[code] ?? 'Could not reconnect. Your changes remain on this computer.', code);
      }
      if (result.user_id !== expectedUid || typeof result.id_token !== 'string' || typeof result.refresh_token !== 'string') throw new Error('Invalid refreshed identity.');
      if (this.session?.passkeyUntil) await this.passkeyClaims(result.id_token, expectedUid);
      if (this.session?.passkeyUntil && this.config!.passkeyOrigin) {
        const client = new PasskeyClient(this.config!.passkeyOrigin!, this.openBrowser);
        try { z.object({current:z.literal(true)}).strict().parse(await client.manage('session',result.id_token)); }
        catch(error){if(error instanceof PasskeyClientError&&error.status===401&&generation===this.generation)this.signOut('Your account security changed. Sign in again with a remaining authenticator or passkey.');throw error;}
        finally{client.cancel();}
      }
      if (this.config!.mfaRequired && !this.session?.enrollmentRequired) {
        const { payload } = await jwtVerify(result.id_token, createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')),
          { issuer: `https://securetoken.google.com/${this.config!.projectId}`, audience: this.config!.projectId, algorithms: ['RS256'] });
        const firebase = payload.firebase as any;
        const full = firebase?.sign_in_provider === 'google.com' || (firebase?.sign_in_provider === 'password' && firebase.sign_in_second_factor === 'totp') || (firebase?.sign_in_provider === 'custom' && this.session?.passkeyUntil && await this.passkeyClaims(result.id_token, expectedUid));
        if (payload.sub !== expectedUid || !full) { this.signOut('Sign in again to verify account security. Your calendar is still on this computer.'); throw new AuthError('Account security verification is required.', 'MFA_REQUIRED'); }
        if (generation !== this.generation) throw new AuthError('Account changed. Sign in again.', 'SIGNED_OUT');
      }
      if (generation !== this.generation) throw new AuthError('Account changed. Sign in again.', 'SIGNED_OUT');
      this.idToken = result.id_token; this.refreshToken = result.refresh_token; this.expires = Date.now() + Math.min(3600, Number(result.expires_in) || 3600)*1000;
      this.session = { ...this.session!, offline: false }; this.persist(); return this.idToken;
    })().finally(() => { this.refreshPromise = null; });
    return this.refreshPromise;
  }
  signOut(notice: string | null = null): void {
    this.signInNotice = notice;
    this.cancelAuthentication(); this.#recentAuthentication = -Infinity; this.#factorLabels = []; this.idToken = ''; this.refreshToken = ''; this.expires = 0; this.session = null; this.remembered = false;
    let failed = false;
    for (const file of [this.filename, `${this.filename}.new`]) { try { fs.rmSync(file, { force: true }); } catch { failed = true; } }
    if (failed) {
      try { fs.writeFileSync(`${this.filename}.signed-out`, '1', { mode: 0o600 }); } catch { /* Still report that disk cleanup failed. */ }
    } else { try { fs.rmSync(`${this.filename}.signed-out`, { force: true }); } catch { failed = true; } }
    this.changed();
    if (failed) throw new AuthError('You are signed out here, but the saved sign-in could not be fully removed. Check this computer’s storage permissions and sign out again.', 'SESSION_REMOVAL_FAILED');
  }
  cancelGoogle(): void { this.cancelOAuth?.(); this.cancelOAuth = null; }
  async google(link = false, expectedAccount?:string): Promise<Session> {
    if (!this.config?.googleClientId) throw new AuthError('Google sign-in is awaiting the owner’s desktop OAuth configuration.', 'GOOGLE_NOT_CONFIGURED');
    this.providerCooldown.check();
    return this.exclusive(async () => {
      const generation=this.generation;
      const existingToken = link ? await this.token() : undefined; const existingUid = link ? this.session!.uid : expectedAccount;
      const verifier = randomBytes(48).toString('base64url'), nonce = randomBytes(24).toString('base64url'), state = randomBytes(24).toString('base64url');
      const callback = oauthCallback(state, async redirect => {
        const params = new URLSearchParams({ client_id: this.config!.googleClientId!, redirect_uri: redirect, response_type: 'code', scope: 'openid email profile', state, nonce, code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256', prompt: 'select_account' });
        await this.openBrowser(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
      });
      this.cancelOAuth = callback.cancel;
      let code: { code: string; redirect: string };
      try { code = await callback.result; } finally { if (this.cancelOAuth === callback.cancel) this.cancelOAuth = null; }
      const params = new URLSearchParams({ client_id: this.config!.googleClientId!, grant_type: 'authorization_code', code: code.code, redirect_uri: code.redirect, code_verifier: verifier });
      if (this.config!.googleClientSecret) params.set('client_secret', this.config!.googleClientSecret);
      const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params, signal: AbortSignal.timeout(20000) });
      this.providerCooldown.observe(response);
      const result = await response.json(); if (!response.ok || typeof result.id_token !== 'string') throw new Error('Google could not complete sign-in. Please try again.');
      const { payload } = await jwtVerify(result.id_token, createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs')), { issuer: ['https://accounts.google.com','accounts.google.com'], audience: this.config!.googleClientId });
      if (payload.nonce !== nonce || payload.email_verified !== true) throw new Error('The Google identity could not be verified.');
      if(generation!==this.generation)throw new AuthError('Account changed. Please sign in again.','SIGNED_OUT');
      return this.accept(await this.request('signInWithIdp', { postBody: new URLSearchParams({ id_token: result.id_token, providerId: 'google.com' }).toString(), requestUri: 'http://localhost', returnSecureToken: true, returnIdpCredential: true, ...(existingToken ? { idToken: existingToken } : {}) }), existingUid,generation);
    });
  }
  async linkPassword(password: string): Promise<void> {
    newPasswordSchema.parse(password);
    await this.exclusive(async () => {
      const account=this.session,generation=this.generation;if(!account)throw new Error('Sign in first.');
      if(account.providers.includes('password'))throw new Error('Use Change password to update an existing password.');
      const token=await this.token();if(generation!==this.generation||this.session?.uid!==account.uid)throw new Error('Account changed. Please sign in again.');
      const result=await this.request('update',{idToken:token,password,returnSecureToken:true});await this.accept({...result,localId:account.uid},account.uid,generation);
    });
  }
  async changePassword(currentPassword: string, password: string): Promise<void> {
    z.string().min(1).max(4096).parse(currentPassword);newPasswordSchema.parse(password);
    if(currentPassword===password)throw new Error('Choose a different new password.');
    await this.exclusive(async () => {
      const account=this.session,generation=this.generation;
      if(!account?.providers.includes('password'))throw new Error('This account does not have email/password sign-in.');
      const verified=await this.request('signInWithPassword',{email:account.email,password:currentPassword,returnSecureToken:true});
      if(generation!==this.generation||this.session?.uid!==account.uid)throw new Error('Account changed. Please sign in again.');
      if(verified.localId!==account.uid||typeof verified.idToken!=='string')throw new Error('The identity does not match the signed-in account.');
      let mutationToken=verified.idToken;
      if(account.passkeyUntil){
        if(performance.now()-this.#recentAuthentication>300000)throw new Error('Sign in again with your passkey before changing your password.');
        mutationToken=await this.token(true);
      }
      if(this.config?.passkeyOrigin&&(this.config.mfaRequired||account.passkeyUntil)){
        const client=new PasskeyClient(this.config.passkeyOrigin,this.openBrowser);
        try{z.object({done:z.literal(true)}).strict().parse(await client.manage('revoke-sessions',mutationToken));}finally{client.cancel();}
        if(generation!==this.generation||this.session?.uid!==account.uid)throw new Error('Account changed. Sign in again.');
      }
      const result=await this.request('update',{idToken:mutationToken,password,returnSecureToken:true});
      if(generation!==this.generation||this.session?.uid!==account.uid)throw new AuthError('Account changed. Please sign in again.','SIGNED_OUT');
      // A successful update invalidates older refresh tokens. Never adopt its
      // replacement credentials: the owner explicitly requires fresh sign-in.
      this.signOut('Password changed. Sign in with your new password.');
      if(result.localId!==account.uid)throw new Error('The password update could not be verified. Sign in with your new password or use password reset.');
    });
  }
  async deleteIdentity(): Promise<void> { await this.request('delete', { idToken: await this.token() }); this.signOut(); }
}
