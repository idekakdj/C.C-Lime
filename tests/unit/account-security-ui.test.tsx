// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AccountSecurity, MfaDialog } from '../../src/renderer/account-security';
import { AuthScreen } from '../../src/renderer/screens';
import type { Snapshot } from '../../src/shared/model';
afterEach(cleanup);
beforeEach(()=>{
  HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
  HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
  window.lime={call:vi.fn(async()=>true) as any,onChange:()=>()=>{},onNavigate:()=>()=>{}};
});
const snapshot={configured:true,googleConfigured:true,session:{uid:'alice',email:'alice@example.test',verified:true,providers:['password']},accountSecurity:{totpAvailable:true,passkeyAvailable:true,factors:[]}} as unknown as Snapshot;
it('keeps both existing sign-ins available and disables passkeys when the gateway is absent',()=>{
  render(<AuthScreen snapshot={{...snapshot,session:null,accountSecurity:{...snapshot.accountSecurity!,passkeyAvailable:false}}} run={vi.fn()}/>);
  expect((screen.getByRole('button',{name:'Sign in'}) as HTMLButtonElement).disabled).toBe(false);
  expect((screen.getByRole('button',{name:/Continue with Google/}) as HTMLButtonElement).disabled).toBe(false);
  expect((screen.getByRole('button',{name:'Sign in with a passkey'}) as HTMLButtonElement).disabled).toBe(true);
});
it('submits a leading-zero authenticator code with only opaque handles',async()=>{
  const user=userEvent.setup(),run=vi.fn(async()=>true);render(<MfaDialog snapshot={{...snapshot,mfaChallenge:{handle:'attempt',expiresInMs:300000,resendInMs:0,factors:[{handle:'factor',kind:'totp',label:'Authenticator app'}]}}} run={run}/>);
  await user.type(screen.getByLabelText('Six-digit code'),'001234');await user.click(screen.getByRole('button',{name:'Verify'}));expect(run).toHaveBeenCalledWith('auth.mfa.verify',{handle:'attempt',factor:'factor',code:'001234'});
});
it('provides both enrollment choices without putting setup secrets in the account summary',()=>{
  render(<AccountSecurity snapshot={{...snapshot,accountSecurity:{...snapshot.accountSecurity!,factors:[{kind:'totp',label:'Authenticator'}]}}} run={vi.fn()}/>);
  expect((screen.getByRole('button',{name:'Add authenticator app'}) as HTMLButtonElement).disabled).toBe(false);expect((screen.getByRole('button',{name:'Add passkey'}) as HTMLButtonElement).disabled).toBe(false);
  expect(screen.queryByLabelText('Manual setup key')).toBeNull();
});
it('password accounts must enroll an authenticator before adding their first passkey',()=>{
  render(<AccountSecurity snapshot={{...snapshot,session:{...snapshot.session!,enrollmentRequired:true}}} run={vi.fn()}/>);
  expect((screen.getByRole('button',{name:'Add passkey'}) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByText(/Email\/password accounts must enroll/)).toBeTruthy();
});
