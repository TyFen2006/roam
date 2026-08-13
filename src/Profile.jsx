import { useRef, useState } from 'react';
import { supabase } from './lib/supabase.js';
import { initials } from './lib/util.js';
import './Profile.css';

export default function Profile({ session, profile, onUpdated }) {
  const [name, setName] = useState(profile?.display_name || '');
  const [username, setUsername] = useState(profile?.username || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const fileRef = useRef(null);

  const ini = initials(name || profile?.display_name || session?.user?.email);

  async function onPickPhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErr(''); setMsg('');
    if (file.size > 5 * 1024 * 1024) { setErr('Photo must be under 5 MB'); return; }
    setUploading(true);
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${session.user.id}/avatar.${ext}`;
      const { error: upErr } = await supabase.storage.from('avatars')
        .upload(path, file, { upsert: true, cacheControl: '3600', contentType: file.type });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
      const { error: dbErr } = await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', session.user.id);
      if (dbErr) throw dbErr;
      setAvatarUrl(publicUrl + '?v=' + Date.now()); // bust cache so the new photo shows
      setMsg('Photo updated!');
      onUpdated?.();
    } catch (e) {
      setErr(e.message || 'Upload failed (did you create the "avatars" bucket?)');
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setErr(''); setMsg(''); setBusy(true);
    try {
      const uname = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
      const { error } = await supabase.from('profiles')
        .update({ display_name: name.trim() || null, username: uname || null })
        .eq('id', session.user.id);
      if (error) {
        if (error.code === '23505') throw new Error('That username is already taken');
        throw error;
      }
      setUsername(uname);
      setMsg('Saved!');
      onUpdated?.();
    } catch (e) {
      setErr(e.message || 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="profile-edit">
      <div className="pe-top">
        <button className="pe-avatar" onClick={() => fileRef.current?.click()} title="Change photo">
          {avatarUrl ? <img src={avatarUrl} alt="" /> : <span>{ini}</span>}
          <span className="pe-cam" aria-hidden>📷</span>
          {uploading && <span className="pe-uploading" />}
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickPhoto} />
        <button className="pe-photo-btn" onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? 'Uploading…' : avatarUrl ? 'Change photo' : 'Add photo'}
        </button>
      </div>

      <label className="fld">
        <span>Name</span>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="What friends call you" />
      </label>
      <label className="fld">
        <span>Username</span>
        <div className="pe-uname">
          <span className="at">@</span>
          <input value={username} onChange={e => setUsername(e.target.value)} placeholder="username" autoCapitalize="none" />
        </div>
      </label>

      {err && <div className="pe-err">{err}</div>}
      {msg && <div className="pe-msg">{msg}</div>}

      <button className="pe-save" onClick={save} disabled={busy}>{busy ? '…' : 'Save profile'}</button>

      <div className="pe-meta">{(profile?.rank || 'Wanderer')} · Level {profile?.level ?? 1}<br />{session?.user?.email}</div>
      <button className="signout" onClick={() => supabase.auth.signOut()}>Sign out</button>
    </div>
  );
}
