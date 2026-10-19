import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { z } from 'zod';

export type EnrollmentTransport = (action: 'start' | 'finalize', body: object, signal: AbortSignal) => Promise<unknown>;
export type TotpSetup = { handle: string; key: string; uri: string; expiresInMs: number };
const secret = z.string().min(1).max(16384);
const resultSchema = z.object({ totpSessionInfo: z.object({
  sharedSecretKey: z.string().regex(/^[A-Z2-7]{16,256}={0,6}$/), verificationCodeLength: z.literal(6),
  hashingAlgorithm: z.literal('SHA1'), periodSec: z.literal(30), sessionInfo: secret,
  finalizeEnrollmentTime: z.string().datetime(),
}) });

/** Setup credentials live here only; no snapshot or persistence contains the setup key. */
export class TotpEnrollment {
  #handle = randomUUID(); #key = ''; #session = ''; #idToken = ''; #uid: string;
  #closed = false; #busy = false; #attempts = 0; #abort = new AbortController();
  #expires = 0; #timer: ReturnType<typeof setTimeout> | undefined;
  #transport: EnrollmentTransport; #now: () => number;
  private constructor(uid: string, transport: EnrollmentTransport, now: () => number) {
    this.#uid = uid; this.#transport = transport; this.#now = now;
  }
  static async start(uid: string, email: string, idToken: string, transport: EnrollmentTransport,
    now = () => performance.now()): Promise<{ attempt: TotpEnrollment; setup: TotpSetup }> {
    const attempt = new TotpEnrollment(uid, transport, now); attempt.#idToken = idToken;
    try {
      const result = resultSchema.safeParse(await transport('start', { idToken, totpEnrollmentInfo: {} }, attempt.#abort.signal));
      if (!result.success) throw new Error('The identity service returned unsupported authenticator settings.');
      const info = result.data.totpSessionInfo;
      const lifetime = Math.min(300000, Date.parse(info.finalizeEnrollmentTime) - Date.now());
      if (!Number.isFinite(lifetime) || lifetime <= 0) throw new Error('Authenticator setup expired. Start again.');
      attempt.#key = info.sharedSecretKey; attempt.#session = info.sessionInfo; attempt.#expires = now() + lifetime;
      attempt.#timer = setTimeout(() => attempt.cancel(), lifetime); attempt.#timer.unref();
      const label = encodeURIComponent(`C.C. Lime:${email}`);
      const query = new URLSearchParams({ secret: attempt.#key, issuer: 'C.C. Lime', algorithm: 'SHA1', digits: '6', period: '30' });
      return { attempt, setup: { handle: attempt.#handle, key: attempt.#key, uri: `otpauth://totp/${label}?${query}`, expiresInMs: lifetime } };
    } catch (error) { attempt.cancel(); throw error; }
  }
  get uid(): string { return this.#uid; }
  async finish(handle: string, code: string, name: string): Promise<{ idToken: string; refreshToken: string }> {
    if (this.#now() >= this.#expires) this.cancel();
    if (this.#closed || handle !== this.#handle) throw new Error('Authenticator setup ended. Start again.');
    if (this.#busy) throw new Error('Authenticator verification is already in progress.');
    if (!/^\d{6}$/.test(code)) throw new Error('Enter the six-digit authenticator code.');
    const displayName = z.string().trim().min(1).max(60).parse(name);
    if (this.#attempts >= 5) { this.cancel(); throw new Error('Too many verification attempts. Start setup again.'); }
    this.#busy = true; this.#attempts++;
    try {
      const response = await this.#transport('finalize', { idToken: this.#idToken, displayName,
        totpVerificationInfo: { sessionInfo: this.#session, verificationCode: code } }, this.#abort.signal);
      if (this.#closed || this.#now() >= this.#expires) throw new Error('Authenticator setup ended. Sign in again to check your factors.');
      const result = z.object({ idToken: secret, refreshToken: secret }).safeParse(response);
      if (!result.success) throw new Error('The identity service returned an invalid enrollment result.');
      this.cancel(); return result.data;
    } finally { this.#busy = false; if (this.#attempts >= 5) this.cancel(); }
  }
  cancel(): void {
    this.#closed = true; this.#key = ''; this.#session = ''; this.#idToken = '';
    this.#abort.abort(); if (this.#timer) clearTimeout(this.#timer);
  }
}
