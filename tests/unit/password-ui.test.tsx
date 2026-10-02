// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthScreen } from '../../src/renderer/screens';
import { PasswordSettings } from '../../src/renderer/password-fields';
import type { Snapshot } from '../../src/shared/model';
afterEach(cleanup);
it('shows the password-change sign-in explanation while keeping both configured sign-in methods available',()=>{
 render(<AuthScreen snapshot={{configured:true,googleConfigured:true,signInNotice:'Password changed. Sign in with your new password.'} as Snapshot} run={vi.fn()}/>);
 expect(screen.getByRole('status').textContent).toBe('Password changed. Sign in with your new password.');expect((screen.getByRole('button',{name:'Sign in'}) as HTMLButtonElement).disabled).toBe(false);expect((screen.getByRole('button',{name:/Continue with Google/}) as HTMLButtonElement).disabled).toBe(false);
});
it('asks for confirmation only when creating a password and clears secrets when switching modes',async()=>{
 const user=userEvent.setup(),run=vi.fn(async()=>null);render(<AuthScreen snapshot={{configured:true,googleConfigured:true} as Snapshot} run={run}/>);
 expect(screen.queryByLabelText('Confirm new password')).toBeNull();await user.click(screen.getByRole('button',{name:'Create an account'}));
 await user.type(screen.getByLabelText('Email address'),'student@example.test');await user.type(screen.getByLabelText('New password'),'Synthetic violet river 47');await user.type(screen.getByLabelText('Confirm new password'),'different');expect((screen.getByRole('button',{name:'Create account'}) as HTMLButtonElement).disabled).toBe(true);
 await user.clear(screen.getByLabelText('Confirm new password'));await user.type(screen.getByLabelText('Confirm new password'),'Synthetic violet river 47');await user.click(screen.getByRole('button',{name:'Create account'}));expect(run).toHaveBeenCalledWith('auth.signUp',expect.objectContaining({password:'Synthetic violet river 47',confirmation:'Synthetic violet river 47'}),undefined);
 await user.click(screen.getByRole('button',{name:'Back to sign in'}));expect((screen.getByLabelText('Password') as HTMLInputElement).value).toBe('');expect(screen.queryByLabelText('Confirm new password')).toBeNull();
});
it('requires the current password and matching new passwords for change and clears them after success',async()=>{
 const user=userEvent.setup(),run=vi.fn(async()=>true);render(<PasswordSettings change run={run}/>);
 await user.type(screen.getByLabelText('Current password'),'old');await user.type(screen.getByLabelText('New password'),'Synthetic violet river 47');expect((screen.getByRole('button',{name:'Change password'}) as HTMLButtonElement).disabled).toBe(true);
 await user.type(screen.getByLabelText('Confirm new password'),'Synthetic violet river 47');await user.click(screen.getByRole('button',{name:'Change password'}));expect(run).toHaveBeenCalledWith('auth.changePassword',{currentPassword:'old',password:'Synthetic violet river 47',confirmation:'Synthetic violet river 47'},'Password changed');
 for(const label of ['Current password','New password','Confirm new password'])expect((screen.getByLabelText(label) as HTMLInputElement).value).toBe('');
});
it('adding password sign-in uses the same strength and confirmation fields without asking for a Google password',()=>{
 render(<PasswordSettings change={false} run={vi.fn()}/>);expect(screen.queryByLabelText('Current password')).toBeNull();expect(screen.getByLabelText('Confirm new password')).toBeTruthy();expect((screen.getByRole('button',{name:'Add password sign-in'}) as HTMLButtonElement).disabled).toBe(true);
});
