import { useEffect, useState, type FormEvent } from 'react';
import type { Snapshot } from '../shared/model';
import { Modal } from './ui';
type Run = (command: string, payload?: unknown, message?: string) => Promise<any>;

export function MfaDialog({ snapshot, run }: { snapshot: Snapshot; run: Run }) {
  const challenge = snapshot.mfaChallenge;
  const [code, setCode] = useState(''), [busy, setBusy] = useState(false), [factor, setFactor] = useState('');
  useEffect(() => { setCode(''); setFactor(challenge?.factors.find(f => f.kind === 'totp')?.handle ?? ''); }, [challenge?.handle]);
  if (!challenge) return null;
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!challenge) return; setBusy(true);
    await run('auth.mfa.verify', { handle: challenge.handle, factor, code }); setCode(''); setBusy(false);
  }
  return <Modal title="Verify with your authenticator" subtitle="Enter the current code from your authenticator app to finish this sign-in or account change." onClose={() => { void run('auth.cancel'); }}>
    <form className="editor" onSubmit={submit}>
      <label>Authenticator<select value={factor} disabled={busy} onChange={e => setFactor(e.target.value)}>{challenge.factors.filter(f => f.kind === 'totp').map(f => <option key={f.handle} value={f.handle}>{f.label}</option>)}</select></label>
      <label>Six-digit code<input autoFocus inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} disabled={busy} onChange={e => setCode(e.target.value.replace(/[^0-9]/g, ''))}/></label>
      <p className="field-help">Codes expire quickly. If one is rejected, check your device’s clock and use the next code.</p>
      {snapshot.accountSecurity?.passkeyAvailable && <button type="button" className="text-button" onClick={async () => { await run('auth.cancel'); await run('auth.passkey.signIn'); }}>Cancel this attempt and sign in with a passkey</button>}
      <footer className="modal-actions"><button type="button" className="button secondary" onClick={() => run('auth.cancel')}>Cancel</button><button className="button primary" disabled={busy || !factor || !/^\d{6}$/.test(code)}>{busy ? 'Verifying…' : 'Verify'}</button></footer>
    </form>
  </Modal>;
}

type Setup = { handle: string; key: string; uri: string; qr: string; expiresInMs: number };
export function AccountSecurity({ snapshot, run }: { snapshot: Snapshot; run: Run }) {
  const [setup, setSetup] = useState<Setup | null>(null), [code, setCode] = useState(''), [name, setName] = useState('Authenticator app');
  const [password, setPassword] = useState(''), [open, setOpen] = useState(false), [busy, setBusy] = useState(false);
  const [passkey, setPasskey] = useState(false);
  const [usePasskey, setUsePasskey] = useState(!!snapshot.session?.passkeyUntil);
  const [manage, setManage] = useState(false), [keys, setKeys] = useState<Array<{id:string;label:string;createdAt:number;lastUsedAt:number|null}> | null>(null), [removeId, setRemoveId] = useState<string|null>(null);
  useEffect(() => () => { void window.lime?.call('auth.totp.cancel').catch(() => {}); }, [snapshot.session?.uid]);
  useEffect(() => { if (!setup) return; const timer = setTimeout(() => { setSetup(null); setCode(''); void run('auth.totp.cancel'); }, setup.expiresInMs); return () => clearTimeout(timer); }, [setup?.handle]);
  if (!snapshot.session) return null;
  const cancel = () => { setOpen(false); setSetup(null); setCode(''); setPassword(''); void run('auth.totp.cancel'); };
  return <section className="settings-card"><h2>Account security</h2>
    {snapshot.accountSecurity?.factors.map((f,i) => <p key={i}>{f.label}</p>)}
    <p className="field-help">Authenticator apps generate codes without SMS charges. Keep access to your enrolled authenticator when moving computers.</p>
    <button className="button secondary" disabled={!snapshot.accountSecurity?.totpAvailable} onClick={() => setOpen(true)}>Add authenticator app</button>
    {!snapshot.accountSecurity?.totpAvailable && <p className="field-help">Authenticator enrollment is awaiting provider activation.</p>}
    <p className="field-help">Passkeys use Windows Hello, a phone or a security key. Your device’s private key stays with your authenticator. Email/password accounts must enroll an authenticator first; you can then sign in with either method.</p>
    <button className="button secondary" disabled={!snapshot.accountSecurity?.passkeyAvailable || !!snapshot.session.enrollmentRequired && snapshot.session.providers.includes('password')} onClick={() => setPasskey(true)}>Add passkey</button>
    <button className="button secondary" disabled={!snapshot.accountSecurity?.passkeyAvailable} onClick={() => {setKeys(null);setManage(true);}}>Manage passkeys</button>
    {!snapshot.accountSecurity?.passkeyAvailable && <p className="field-help">Passkeys are awaiting trusted server configuration.</p>}
    {manage && <Modal title="Manage passkeys" subtitle="Confirm your account to view or remove registered passkeys. Keep a remaining authenticator or passkey for recovery." onClose={() => {setManage(false);setKeys(null);setRemoveId(null);setPassword('');void run('auth.cancel');}}>
      {!keys ? <form className="editor" onSubmit={async event=>{event.preventDefault();setBusy(true);try{
        const method=usePasskey?'passkey':snapshot.session!.providers.includes('password')?'password':'google';
        if(!await run('auth.reauthenticate',{method,...(method==='password'?{password}:{})}))return;
        setPassword('');const result=await run('auth.passkey.list');if(result)setKeys(result.credentials);
      }finally{setBusy(false);}}}>
        <label><input type="checkbox" disabled={busy} checked={usePasskey} onChange={e=>setUsePasskey(e.target.checked)}/> Confirm with an existing passkey</label>
        {!usePasskey&&snapshot.session.providers.includes('password')&&<label>Current password<input type="password" autoComplete="current-password" required disabled={busy} value={password} onChange={e=>setPassword(e.target.value)}/></label>}
        <button className="button primary" disabled={busy}>{busy?'Verifying…':'Confirm and view passkeys'}</button>
      </form> : <div className="editor">{!keys.length&&<p>No passkeys are registered for this account.</p>}{keys.map(key=><div key={key.id}><b>{key.label}</b><p className="field-help">Added {new Date(key.createdAt).toLocaleDateString()}{key.lastUsedAt?` · Last used ${new Date(key.lastUsedAt).toLocaleDateString()}`:''}</p><button className="button secondary" disabled={busy} onClick={()=>setRemoveId(key.id)}>Remove {key.label}</button></div>)}</div>}
      {removeId&&<Modal title="Remove this passkey?" subtitle="This also ends existing passkey sessions. You will need a remaining authenticator or passkey to sign in again." onClose={()=>setRemoveId(null)}><footer className="modal-actions"><button className="button secondary" disabled={busy} onClick={()=>setRemoveId(null)}>Keep passkey</button><button className="button danger-fill" disabled={busy} onClick={async()=>{setBusy(true);try{if(await run('auth.passkey.remove',{id:removeId})){setRemoveId(null);setKeys(null);setManage(false);}}finally{setBusy(false);}}}>Remove passkey</button></footer></Modal>}
    </Modal>}
    {passkey && <Modal title="Add a passkey" subtitle="Confirm your account, then choose Windows Hello, your phone or a security key in your browser." onClose={() => { setPasskey(false); setPassword(''); void run('auth.cancel'); }}>
      <form className="editor" onSubmit={async event => { event.preventDefault(); setBusy(true); try {
        const method = usePasskey ? 'passkey' : snapshot.session!.providers.includes('password') ? 'password' : 'google';
        if (!await run('auth.reauthenticate', { method, ...(method === 'password' ? { password } : {}) })) return;
        setPassword(''); if (await run('auth.passkey.register', { name }, 'Passkey added. You can use it at sign-in.')) setPasskey(false);
      } finally { setBusy(false); } }}>
        <label><input type="checkbox" checked={usePasskey} disabled={busy} onChange={e=>setUsePasskey(e.target.checked)}/> Confirm with an existing passkey</label>
        {!usePasskey && snapshot.session.providers.includes('password') && <label>Current password<input type="password" autoComplete="current-password" required value={password} disabled={busy} onChange={e => setPassword(e.target.value)}/></label>}
        <label>Passkey name<input required maxLength={60} value={name} disabled={busy} onChange={e => setName(e.target.value)}/></label>
        <footer className="modal-actions"><button type="button" className="button secondary" onClick={() => {setPasskey(false);setPassword('');void run('auth.cancel');}}>Cancel</button><button className="button primary" disabled={busy}>{busy ? 'Waiting for verification…' : 'Continue in browser'}</button></footer>
      </form>
    </Modal>}
    {open && <Modal title="Add an authenticator app" subtitle="Confirm your account, then scan the code and verify a current authenticator code." onClose={cancel}>
      <form className="editor" onSubmit={async event => { event.preventDefault(); setBusy(true); try {
        if (!setup) {
          const method = snapshot.session!.providers.includes('password') ? 'password' : 'google';
          if (!await run('auth.reauthenticate', { method, ...(method === 'password' ? { password } : {}) })) return;
          setPassword(''); const result = await run('auth.totp.start'); if (result) setSetup(result);
        } else if (await run('auth.totp.finish', { handle: setup.handle, code, name })) cancel();
      } finally { setBusy(false); } }}>
        {!setup ? snapshot.session.providers.includes('password') ? <label>Current password<input type="password" autoComplete="current-password" required disabled={busy} value={password} onChange={e => setPassword(e.target.value)}/></label> : <p>Continue to confirm your Google account.</p> : <>
          <img className="totp-qr" width={256} height={256} src={setup.qr} alt="Scan this setup code with your authenticator app"/>
          <label>Manual setup key<input readOnly value={setup.key} autoComplete="off" spellCheck={false}/></label>
          <p className="field-help">Keep this key private. It disappears when you finish or cancel setup.</p>
          <label>Authenticator name<input required maxLength={60} disabled={busy} value={name} onChange={e => setName(e.target.value)}/></label>
          <label>Six-digit code<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required maxLength={6} disabled={busy} value={code} onChange={e => setCode(e.target.value.replace(/[^0-9]/g,''))}/></label>
        </>}
        <footer className="modal-actions"><button type="button" className="button secondary" onClick={cancel}>Cancel</button><button className="button primary" disabled={busy || !!setup && !/^\d{6}$/.test(code)}>{busy ? 'One moment…' : setup ? 'Verify and add' : 'Confirm account'}</button></footer>
      </form>
    </Modal>}
  </section>;
}
