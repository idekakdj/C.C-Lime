import { afterEach, expect, it, vi } from 'vitest';
import { MfaSignInAttempt, type MfaTransport } from '../../src/main/mfa-sign-in';
const fixture = { mfaPendingCredential: 'synthetic-pending-private', mfaInfo: [
  { mfaEnrollmentId: 'private-enrollment-phone', phoneInfo: '+15555551234' },
  { mfaEnrollmentId: 'private-enrollment-totp', totpInfo: {} },
] };
const attempts: MfaSignInAttempt[] = [];
afterEach(() => { attempts.splice(0).forEach(value => value.cancel()); });
function make(transport: MfaTransport = vi.fn(), now?: () => number) {
  const attempt = new MfaSignInAttempt(fixture, transport, now); attempts.push(attempt); return attempt;
}
it('exposes only opaque handles/masked labels and cannot serialize pending credentials', () => {
  const a = make(), text = JSON.stringify(a.view()) + JSON.stringify(a);
  for (const secret of ['synthetic-pending-private', 'private-enrollment-phone', 'private-enrollment-totp', '+15555551234']) expect(text).not.toContain(secret);
  expect(a.view().factors.map(value => value.kind)).toEqual(['phone', 'totp']);
  expect(a.view().factors[0].label).toBe('Text message ending in 1234');
});
it.each([
  {}, { ...fixture, mfaPendingCredential: '' }, { ...fixture, mfaInfo: [] },
  { ...fixture, mfaInfo: Array(6).fill(fixture.mfaInfo[0]) },
  { ...fixture, mfaInfo: [fixture.mfaInfo[0], fixture.mfaInfo[0]] },
  { ...fixture, mfaInfo: [{ mfaEnrollmentId: 'id' }] },
  { ...fixture, mfaInfo: [{ mfaEnrollmentId: 'id', phoneInfo: '+15555551234', totpInfo: {} }] },
  { ...fixture, mfaInfo: [{ mfaEnrollmentId: 'id', phoneInfo: 'https://example.test' }] },
])('rejects malformed or ambiguous pending response without secret-bearing errors', value => {
  expect(() => new MfaSignInAttempt(value, vi.fn())).toThrow('identity service');
});
it('binds SMS start/finalize to one factor, consumes success and never returns provider auxiliary fields', async () => {
  const transport = vi.fn<MfaTransport>().mockResolvedValueOnce({ phoneResponseInfo: { sessionInfo: 'private-session' } })
    .mockResolvedValueOnce({ idToken: 'final-id', refreshToken: 'final-refresh', phoneAuthInfo: { private: true } });
  const a = make(transport), view = a.view(), phone = view.factors[0].handle;
  await expect(a.verify(view.handle, phone, '123456')).rejects.toMatchObject({ code: 'SMS_NOT_STARTED' });
  await a.sendSms(view.handle, phone, 'synthetic-recaptcha');
  expect(transport.mock.calls[0].slice(0, 2)).toEqual(['start', { mfaPendingCredential: fixture.mfaPendingCredential,
    mfaEnrollmentId: 'private-enrollment-phone', phoneSignInInfo: { recaptchaToken: 'synthetic-recaptcha' } }]);
  await expect(a.verify(view.handle, phone, '123456')).resolves.toEqual({ idToken: 'final-id', refreshToken: 'final-refresh' });
  expect(transport.mock.calls[1][1]).toMatchObject({ phoneVerificationInfo: { sessionInfo: 'private-session', code: '123456' } });
  await expect(a.verify(view.handle, phone, '123456')).rejects.toMatchObject({ code: 'CHALLENGE_ENDED' });
});
it('verifies TOTP without requesting an SMS or reCAPTCHA', async () => {
  const transport = vi.fn<MfaTransport>().mockResolvedValue({ idToken: 'final-id', refreshToken: 'final-refresh' });
  const a = make(transport), view = a.view();
  await expect(a.verify(view.handle, view.factors[1].handle, '123456')).resolves.toMatchObject({ idToken: 'final-id' });
  expect(transport).toHaveBeenCalledTimes(1); expect(transport.mock.calls[0][1]).toMatchObject({ totpVerificationInfo: { verificationCode: '123456' } });
});
it('rejects another challenge/factor, malformed codes and absent browser verification before any effect', async () => {
  const transport = vi.fn(), a = make(transport), b = make(), view = a.view();
  await expect(a.verify(b.view().handle, view.factors[1].handle, '123456')).rejects.toMatchObject({ code: 'CHALLENGE_ENDED' });
  await expect(a.verify(view.handle, b.view().factors[1].handle, '123456')).rejects.toMatchObject({ code: 'INVALID_FACTOR' });
  for (const code of ['12345', '1234567', '１２３４５６', 'abcdef', 123456 as unknown as string]) await expect(a.verify(view.handle, view.factors[1].handle, code)).rejects.toMatchObject({ code: 'INVALID_CODE' });
  await expect(a.sendSms(view.handle, view.factors[0].handle, '')).rejects.toMatchObject({ code: 'INVALID_VERIFICATION' });
  expect(transport).not.toHaveBeenCalled();
});
it('bounds sends and verifies failed-send cooldown; expiry cannot be extended by a resend', async () => {
  let now = 0; const transport = vi.fn<MfaTransport>().mockRejectedValue(new Error('private upstream data'));
  const a = make(transport, () => now), view = a.view();
  for (let i = 0; i < 3; i++) {
    now = i*60_000; await expect(a.sendSms(view.handle, view.factors[0].handle, 'captcha')).rejects.toMatchObject({ code: 'SEND_FAILED' });
    await expect(a.sendSms(view.handle, view.factors[0].handle, 'captcha')).rejects.toMatchObject({ code: 'SEND_LIMIT' });
  }
  now = 180_000; await expect(a.sendSms(view.handle, view.factors[0].handle, 'captcha')).rejects.toMatchObject({ code: 'SEND_LIMIT' });
  expect(transport).toHaveBeenCalledTimes(3); now = 300_000;
  expect(() => a.view()).toThrow('attempt ended');
});
it('keeps the failed-verification budget across resends and masks transport errors', async () => {
  let now = 0; const transport = vi.fn<MfaTransport>(async action => {
    if (action === 'start') return { phoneResponseInfo: { sessionInfo: 'private-session' } };
    throw new Error('private upstream pending credential');
  });
  const a = make(transport, () => now), view = a.view(), factor = view.factors[0].handle;
  await a.sendSms(view.handle, factor, 'captcha');
  for (let i = 0; i < 5; i++) {
    if (i === 3) { now = 60_000; await a.sendSms(view.handle, factor, 'new-captcha'); }
    await expect(a.verify(view.handle, factor, '123456')).rejects.toThrow('MFA verification failed');
  }
  await expect(a.verify(view.handle, factor, '123456')).rejects.toMatchObject({ code: 'CHALLENGE_ENDED' });
  expect(transport.mock.calls.filter(value => value[0] === 'finalize')).toHaveLength(5);
});
it.each(['start', 'finalize'] as const)('cancellation aborts %s and suppresses a late successful response', async action => {
  let finish!: (value: unknown) => void; const transport = vi.fn<MfaTransport>(() => new Promise(resolve => { finish = resolve; }));
  const a = make(transport), view = a.view();
  const pending = action === 'start' ? a.sendSms(view.handle, view.factors[0].handle, 'captcha') : a.verify(view.handle, view.factors[1].handle, '123456');
  await expect(a.verify(view.handle, view.factors[1].handle, '123456')).rejects.toMatchObject({ code: 'BUSY' });
  a.cancel(); expect(transport.mock.calls[0][2].aborted).toBe(true);
  finish(action === 'start' ? { phoneResponseInfo: { sessionInfo: 'private-session' } } : { idToken: 'late-id', refreshToken: 'late-refresh' });
  await expect(pending).rejects.toMatchObject({ code: 'CHALLENGE_ENDED' });
});
it('rejects malformed successful responses instead of accepting an incomplete session', async () => {
  const a = make(vi.fn<MfaTransport>().mockResolvedValue({ idToken: 'id-only' })), view = a.view();
  await expect(a.verify(view.handle, view.factors[1].handle, '123456')).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
});
