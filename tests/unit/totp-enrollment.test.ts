import { expect, it, vi } from 'vitest';
import { TotpEnrollment } from '../../src/main/totp-enrollment';
import { authResponse } from '../../src/main/auth-response';
const response = () => ({ totpSessionInfo: { sharedSecretKey: 'JBSWY3DPEHPK3PXP', sessionInfo: 'synthetic-enrollment-session', verificationCodeLength: 6, hashingAlgorithm: 'SHA1', periodSec: 30, finalizeEnrollmentTime: new Date(Date.now()+300000).toISOString() } });
it('keeps the setup key out of serialization and submits only the bound provider session', async () => {
  const transport = vi.fn(async (action: string, _body: object, _signal: AbortSignal) => action === 'start' ? response() : { idToken: 'synthetic-id', refreshToken: 'synthetic-refresh' });
  const { attempt, setup } = await TotpEnrollment.start('alice', 'alice+test@example.test', 'synthetic-first-factor', transport);
  expect(JSON.stringify(attempt)).toBe('{}'); expect(setup.uri).toContain('alice%2Btest%40example.test');
  await expect(attempt.finish(setup.handle, '001234', 'My authenticator')).resolves.toHaveProperty('idToken');
  expect(transport.mock.calls[1][1]).toEqual({ idToken: 'synthetic-first-factor', displayName: 'My authenticator', totpVerificationInfo: { sessionInfo: 'synthetic-enrollment-session', verificationCode: '001234' } });
  await expect(attempt.finish(setup.handle, '001234', 'Again')).rejects.toThrow('ended');
});
it.each(['hashingAlgorithm','periodSec','verificationCodeLength'])('rejects unsupported %s without exposing the key', async field => {
  const value = response(); (value.totpSessionInfo as any)[field] = field === 'hashingAlgorithm' ? 'SHA256' : 8;
  await expect(TotpEnrollment.start('alice','alice@example.test','id',async()=>value)).rejects.toThrow('unsupported');
});
it('bounds attempts, expiry, malformed codes and account handles', async () => {
  let now = 0; const transport = vi.fn(async action => { if (action === 'start') return response(); throw Error('provider denied'); });
  const { attempt, setup } = await TotpEnrollment.start('alice','alice@example.test','id',transport,()=>now);
  await expect(attempt.finish('wrong','123456','Name')).rejects.toThrow('ended');
  await expect(attempt.finish(setup.handle,'１２３４５６','Name')).rejects.toThrow('six-digit');
  for(let i=0;i<5;i++) await expect(attempt.finish(setup.handle,'123456','Name')).rejects.toThrow('provider denied');
  await expect(attempt.finish(setup.handle,'123456','Name')).rejects.toThrow('ended');
  const later = await TotpEnrollment.start('alice','alice@example.test','id',async()=>response(),()=>now); now = 300001;
  await expect(later.attempt.finish(later.setup.handle,'123456','Name')).rejects.toThrow('ended');
});
it('ignores a late successful finalize after cancellation', async () => {
  let resolve!: (value: unknown) => void;
  const { attempt, setup } = await TotpEnrollment.start('alice','alice@example.test','id',async action => action === 'start' ? response() : new Promise(r=>{resolve=r;}));
  const finalizing = attempt.finish(setup.handle,'123456','Name'); attempt.cancel(); resolve({idToken:'late',refreshToken:'late'});
  await expect(finalizing).rejects.toThrow('ended');
});
it('bounds streaming provider responses and rejects invalid JSON without reflecting their contents',async()=>{
  await expect(authResponse(new Response('sensitive-not-json'))).rejects.toThrow('invalid response');
  await expect(authResponse(new Response('x'.repeat(131073)))).rejects.toThrow('oversized');
  await expect(authResponse(new Response('{}',{headers:{'content-length':'131073'}}))).rejects.toThrow('oversized');
  await expect(authResponse(new Response('{"ok":true}'))).resolves.toEqual({ok:true});
});
