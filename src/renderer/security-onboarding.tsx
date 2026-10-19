import type { Snapshot } from '../shared/model';
import { Logo } from './ui';
import { AccountSecurity } from './account-security';
type Run=(command:string,payload?:unknown,message?:string)=>Promise<any>;
export function SecurityOnboarding({snapshot,run}:{snapshot:Snapshot;run:Run}){
  return <div className="auth-page"><div className="auth-story"><Logo/><div className="auth-copy"><h1>Protect your<br/><span>personal calendar.</span></h1><p>Enroll an authenticator app to protect email/password sign-in. You can then add a passkey and use either method to return.</p></div></div>
    <div className="auth-form-wrap"><div className="auth-form"><h2>Set up account security</h2><p>{snapshot.session?.email}</p>
      {!snapshot.session?.verified&&<><p>Verify your email first using the link in your inbox.</p><button className="button secondary" onClick={()=>run('auth.verify',undefined,'Verification email sent.')}>Send verification email</button><button className="button secondary" onClick={()=>run('auth.refresh')}>I verified my email</button></>}
      <AccountSecurity snapshot={snapshot} run={run}/>
      {snapshot.accountSecurity?.passkeyAvailable&&<button className="button primary full" onClick={()=>run('auth.passkey.signIn')}>Sign in with your registered passkey</button>}
      <button className="text-button" onClick={()=>run('auth.signOut')}>Back to sign in</button>
    </div></div>
  </div>;
}
