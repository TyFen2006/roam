import { useState } from 'react';
import { supabase } from './lib/supabase.js';
import './Auth.css';

export default function Auth() {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  async function submit(e) {
    e.preventDefault();
    setErr(''); setMsg(''); setBusy(true);
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email, password: pw,
          options: { data: { display_name: name.trim() || email.split('@')[0] } },
        });
        if (error) throw error;
        // If email confirmation is on, there's no session yet.
        if (!data.session) setMsg('Account created! Check your email to confirm, then log in.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
        if (error) throw error;
        // success → App's auth listener swaps to the app
      }
    } catch (e) {
      setErr(e.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <div className="auth-hero">
        <div className="auth-mark">ROAM</div>
        <div className="auth-tag">running scored on fun, not pace</div>
      </div>

      <form className="auth-card" onSubmit={submit}>
        <div className="auth-switch">
          <button type="button" className={mode === 'login' ? 'on' : ''} onClick={() => { setMode('login'); setErr(''); setMsg(''); }}>Log in</button>
          <button type="button" className={mode === 'signup' ? 'on' : ''} onClick={() => { setMode('signup'); setErr(''); setMsg(''); }}>Sign up</button>
        </div>

        {mode === 'signup' && (
          <label className="fld">
            <span>Name</span>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="What friends call you" autoComplete="name" />
          </label>
        )}
        <label className="fld">
          <span>Email</span>
          <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" autoComplete="email" />
        </label>
        <label className="fld">
          <span>Password</span>
          <input type="password" required minLength={6} value={pw} onChange={e => setPw(e.target.value)} placeholder="at least 6 characters" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
        </label>

        {err && <div className="auth-err">{err}</div>}
        {msg && <div className="auth-msg">{msg}</div>}

        <button className="auth-go" type="submit" disabled={busy}>
          {busy ? '…' : mode === 'login' ? 'Log in' : 'Create account'}
        </button>

        <p className="auth-foot">
          {mode === 'login'
            ? <>New here? <button type="button" onClick={() => setMode('signup')}>Make an account</button></>
            : <>Already have one? <button type="button" onClick={() => setMode('login')}>Log in</button></>}
        </p>
      </form>
    </div>
  );
}
