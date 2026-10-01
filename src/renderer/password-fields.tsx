import { useId, useState } from 'react';
import { passwordFeedback } from '../shared/password';

export function NewPasswordFields({ password, confirmation, setPassword, setConfirmation, disabled=false }: { password:string;confirmation:string;setPassword(value:string):void;setConfirmation(value:string):void;disabled?:boolean }) {
  const id=useId(),feedback=passwordFeedback(password);
  return <><label>New password<input type="password" autoComplete="new-password" required maxLength={256} value={password} disabled={disabled} onChange={e=>setPassword(e.target.value)} aria-describedby={id}/></label><p id={id} className="field-help" role="status">{feedback.label}. {feedback.hint} Strength is an estimate, not a guarantee.</p><label>Confirm new password<input type="password" autoComplete="new-password" required maxLength={256} value={confirmation} disabled={disabled} onChange={e=>setConfirmation(e.target.value)}/></label>{confirmation&&confirmation!==password&&<p className="form-error" role="status">The new passwords must match.</p>}</>;
}
export function PasswordSettings({ change, run }: { change:boolean;run(command:string,payload?:unknown,message?:string):Promise<any> }) {
  const [current,setCurrent]=useState(''),[password,setPassword]=useState(''),[confirmation,setConfirmation]=useState(''),[busy,setBusy]=useState(false);
  const clear=()=>{setCurrent('');setPassword('');setConfirmation('');};
  return <form className="password-settings" onSubmit={async e=>{e.preventDefault();setBusy(true);try{if(await run(change?'auth.changePassword':'auth.linkPassword',{...(change?{currentPassword:current}:{}),password,confirmation},change?'Password changed':'Password sign-in added'))clear();}finally{setCurrent('');setBusy(false);}}}>
    <h3>{change?'Change password':'Add email/password sign-in'}</h3>
    {change&&<label>Current password<input type="password" required autoComplete="current-password" value={current} maxLength={4096} disabled={busy} onChange={e=>setCurrent(e.target.value)}/></label>}
    <NewPasswordFields password={password} confirmation={confirmation} setPassword={setPassword} setConfirmation={setConfirmation} disabled={busy}/>
    <div className="button-row"><button className="button secondary" disabled={busy||(change&&!current)||!passwordFeedback(password).valid||password!==confirmation}>{busy?'Updating…':change?'Change password':'Add password sign-in'}</button><button type="button" className="text-button" disabled={busy} onClick={clear}>Clear fields</button></div>
  </form>;
}
