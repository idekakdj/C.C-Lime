import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { z } from 'zod';

// Ephemeral main-process challenge used by AuthService; pending credentials never enter snapshots.
// Transport is origin-pinned and provider-rate-limited. Provider activation is a separate rollout.
export type MfaTransport = (action: 'start' | 'finalize', body: object, signal: AbortSignal) => Promise<unknown>;
export class MfaAttemptError extends Error {
  constructor(message: string, readonly code: string) { super(message); }
}
const secret = z.string().min(1).max(16384);
const pendingSchema = z.object({ mfaPendingCredential: secret, mfaInfo: z.array(z.object({
  mfaEnrollmentId: z.string().min(1).max(1024),
  phoneInfo: z.string().regex(/^\+[0-9*]{6,24}$/).optional(),
  totpInfo: z.object({}).optional(),
})).min(1).max(5) });
type Factor = { handle: string; enrollmentId: string; kind: 'phone' | 'totp'; label: string };
export type MfaChallengeView = { handle: string; expiresInMs: number; resendInMs: number; factors: Array<{ handle: string; kind: 'phone' | 'totp'; label: string }> };

/** An ephemeral first-factor challenge; no session, persistence or calendar access. */
export class MfaSignInAttempt {
  #handle = randomUUID();
  #credential = '';
  #factors: Factor[] = [];
  #sms: { factor: string; session: string } | null = null;
  #sendCount = 0;
  #verificationCount = 0;
  #nextSend = -Infinity;
  #busy = false;
  #closed = false;
  #abort = new AbortController();
  #expires: number;
  #timer: ReturnType<typeof setTimeout>;
  #transport: MfaTransport;
  #now: () => number;
  constructor(response: unknown, transport: MfaTransport, now = () => performance.now()) {
    const parsed = pendingSchema.safeParse(response);
    if (!parsed.success) throw new MfaAttemptError('The identity service returned an invalid MFA challenge.', 'INVALID_CHALLENGE');
    const ids = new Set<string>();
    for (const factor of parsed.data.mfaInfo) {
      if (ids.has(factor.mfaEnrollmentId) || Boolean(factor.phoneInfo) === Boolean(factor.totpInfo))
        throw new MfaAttemptError('The identity service returned unsupported MFA factors.', 'INVALID_CHALLENGE');
      ids.add(factor.mfaEnrollmentId);
      const lastFour = factor.phoneInfo?.match(/\d{4}$/)?.[0];
      if (factor.phoneInfo && !lastFour) throw new MfaAttemptError('The identity service returned an invalid phone factor.', 'INVALID_CHALLENGE');
      this.#factors.push({ handle: randomUUID(), enrollmentId: factor.mfaEnrollmentId,
        kind: factor.phoneInfo ? 'phone' : 'totp', label: factor.phoneInfo ? `Text message ending in ${lastFour}` : 'Authenticator app' });
    }
    this.#credential = parsed.data.mfaPendingCredential; this.#transport = transport; this.#now = now;
    this.#expires = now() + 300_000;
    this.#timer = setTimeout(() => this.cancel(), 300_000); this.#timer.unref();
  }
  #check(handle: string): void {
    if (this.#now() >= this.#expires) this.cancel();
    if (this.#closed || handle !== this.#handle) throw new MfaAttemptError('This sign-in attempt ended. Sign in again.', 'CHALLENGE_ENDED');
  }
  #factor(handle: string): Factor {
    const factor = this.#factors.find(value => value.handle === handle);
    if (!factor) throw new MfaAttemptError('Choose a factor from this sign-in attempt.', 'INVALID_FACTOR');
    return factor;
  }
  view(): MfaChallengeView {
    this.#check(this.#handle);
    return { handle: this.#handle, expiresInMs: Math.max(0, this.#expires-this.#now()),
      resendInMs: Math.max(0, this.#nextSend-this.#now()), factors: this.#factors.map(({ handle, kind, label }) => ({ handle, kind, label })) };
  }
  async sendSms(handle: string, factorHandle: string, recaptchaToken: string): Promise<void> {
    this.#check(handle); const factor = this.#factor(factorHandle);
    if (this.#busy) throw new MfaAttemptError('MFA verification is already in progress.', 'BUSY');
    if (factor.kind !== 'phone' || !z.string().min(1).max(8192).safeParse(recaptchaToken).success)
      throw new MfaAttemptError('Complete browser verification before requesting a text message.', 'INVALID_VERIFICATION');
    if (this.#now() < this.#nextSend || this.#sendCount >= 3)
      throw new MfaAttemptError('Wait before requesting another code, or start a new sign-in attempt.', 'SEND_LIMIT');
    this.#busy = true; this.#sendCount++; this.#nextSend = this.#now()+60_000;
    // A resend invalidates the prior local SMS session, including failed sends.
    this.#sms = null;
    try {
      const result = await this.#transport('start', { mfaPendingCredential: this.#credential,
        mfaEnrollmentId: factor.enrollmentId, phoneSignInInfo: { recaptchaToken } }, this.#abort.signal);
      this.#check(handle);
      const parsed = z.object({ phoneResponseInfo: z.object({ sessionInfo: secret }) }).safeParse(result);
      if (!parsed.success) throw new MfaAttemptError('The identity service returned an invalid SMS challenge.', 'INVALID_RESPONSE');
      this.#sms = { factor: factorHandle, session: parsed.data.phoneResponseInfo.sessionInfo };
    } catch (error) {
      if (error instanceof MfaAttemptError) throw error;
      throw new MfaAttemptError('The text message could not be requested. Try again after the waiting period.', 'SEND_FAILED');
    } finally { this.#busy = false; }
  }
  // Only the main-process AuthService may consume these credentials. It must
  // validate provider account/UID and MFA claims before accepting any session.
  async verify(handle: string, factorHandle: string, code: string): Promise<{ idToken: string; refreshToken: string }> {
    this.#check(handle); const factor = this.#factor(factorHandle);
    if (this.#busy) throw new MfaAttemptError('MFA verification is already in progress.', 'BUSY');
    if (typeof code !== 'string' || !/^\d{6}$/.test(code)) throw new MfaAttemptError('Enter the six-digit verification code.', 'INVALID_CODE');
    if (factor.kind === 'phone' && this.#sms?.factor !== factorHandle)
      throw new MfaAttemptError('Request a text message for this factor first.', 'SMS_NOT_STARTED');
    if (this.#verificationCount >= 5) { this.cancel(); throw new MfaAttemptError('Too many verification attempts. Sign in again.', 'VERIFY_LIMIT'); }
    this.#busy = true; this.#verificationCount++;
    try {
      const result = await this.#transport('finalize', { mfaPendingCredential: this.#credential, mfaEnrollmentId: factor.enrollmentId,
        ...(factor.kind === 'phone' ? { phoneVerificationInfo: { sessionInfo: this.#sms!.session, code } }
          : { totpVerificationInfo: { verificationCode: code } }) }, this.#abort.signal);
      this.#check(handle);
      const parsed = z.object({ idToken: secret, refreshToken: secret }).safeParse(result);
      if (!parsed.success) throw new MfaAttemptError('The identity service returned an invalid MFA result.', 'INVALID_RESPONSE');
      this.cancel(); return parsed.data;
    } catch (error) {
      if (this.#verificationCount >= 5) this.cancel();
      if (error instanceof MfaAttemptError) throw error;
      throw new MfaAttemptError('MFA verification failed. Check the code or sign in again.', 'VERIFY_FAILED');
    } finally { this.#busy = false; }
  }
  cancel(): void {
    this.#closed = true; this.#credential = ''; this.#factors = []; this.#sms = null;
    this.#abort.abort(); clearTimeout(this.#timer);
  }
}
