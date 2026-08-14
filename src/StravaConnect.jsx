import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase.js';
import { stravaConfigured, stravaAuthUrl, importFromStrava } from './lib/strava.js';

export default function StravaConnect({ userId }) {
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!userId) return;
    supabase.from('strava_accounts').select('user_id').eq('user_id', userId).maybeSingle()
      .then(({ data }) => setConnected(!!data));
  }, [userId]);

  // Strava import is paused until the keys are configured — hide it entirely for now.
  if (!stravaConfigured) return null;

  async function doImport() {
    setBusy(true); setMsg('');
    try {
      const r = await importFromStrava(userId);
      setMsg(r.imported ? `Imported ${r.imported} run${r.imported === 1 ? '' : 's'} — check your map! 🗺️` : 'No new runs to import.');
    } catch (e) {
      setMsg(e.message || 'Import failed');
    } finally { setBusy(false); }
  }

  return (
    <div className="strava-card">
      <div className="strava-head">🔗 Strava</div>
      {!connected ? (
        <button className="strava-btn" onClick={() => { window.location.href = stravaAuthUrl(); }}>Connect Strava</button>
      ) : (
        <>
          <div className="strava-connected">✓ Connected</div>
          <button className="strava-btn" disabled={busy} onClick={doImport}>{busy ? 'Importing…' : 'Import recent runs'}</button>
        </>
      )}
      {msg && <div className="strava-msg">{msg}</div>}
    </div>
  );
}
