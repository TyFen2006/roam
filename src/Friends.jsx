import { useCallback, useEffect, useState } from 'react';
import { supabase } from './lib/supabase.js';
import { initials } from './lib/util.js';

function Avatar({ p, size = 46 }) {
  const ini = initials(p?.display_name || p?.username);
  return (
    <div className="s-avatar" style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {p?.avatar_url ? <img src={p.avatar_url} alt="" /> : ini}
    </div>
  );
}

export default function Friends({ userId }) {
  const [sel, setSel] = useState({ t: 'home' });
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [outgoing, setOutgoing] = useState(new Set());
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    if (!userId || !supabase) return;
    setLoading(true); setErr('');
    try {
      const { data: fr, error } = await supabase
        .from('friendships').select('id,requester,addressee,status')
        .or(`requester.eq.${userId},addressee.eq.${userId}`);
      if (error) throw error;

      const accepted = fr.filter(f => f.status === 'accepted');
      const friendIds = accepted.map(f => (f.requester === userId ? f.addressee : f.requester));
      const incoming = fr.filter(f => f.status === 'pending' && f.addressee === userId);
      const outIds = new Set(fr.filter(f => f.status === 'pending' && f.requester === userId).map(f => f.addressee));

      const ids = [...new Set([...friendIds, ...incoming.map(f => f.requester)])];
      let byId = {};
      if (ids.length) {
        const { data: profs } = await supabase.from('profiles')
          .select('id,display_name,username,avatar_url,points,rank,level').in('id', ids);
        byId = Object.fromEntries((profs || []).map(p => [p.id, p]));
      }
      setFriends(friendIds.map(id => byId[id]).filter(Boolean).sort((a, b) => (b.points || 0) - (a.points || 0)));
      setRequests(incoming.map(f => ({ fid: f.id, p: byId[f.requester] })).filter(r => r.p));
      setOutgoing(outIds);
    } catch (e) {
      setErr(e.message || 'Could not load friends');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  async function search(e) {
    e?.preventDefault();
    const term = q.trim().replace(/^@/, '');
    if (!term) { setResults(null); return; }
    setErr('');
    const { data, error } = await supabase.from('profiles')
      .select('id,display_name,username,avatar_url,points')
      .ilike('username', `%${term}%`).neq('id', userId).limit(12);
    if (error) { setErr(error.message); return; }
    setResults(data || []);
  }

  async function sendRequest(id) {
    setBusy(id); setErr('');
    try {
      const { error } = await supabase.from('friendships').insert({ requester: userId, addressee: id, status: 'pending' });
      if (error) { if (error.code === '23505') throw new Error('Already requested'); throw error; }
      setOutgoing(new Set([...outgoing, id]));
    } catch (e) { setErr(e.message); } finally { setBusy(''); }
  }
  async function accept(fid) { setBusy(fid); await supabase.from('friendships').update({ status: 'accepted' }).eq('id', fid); await load(); setBusy(''); }
  async function decline(fid) { setBusy(fid); await supabase.from('friendships').delete().eq('id', fid); await load(); setBusy(''); }

  if (sel.t === 'friend') {
    const p = sel.p;
    return (
      <>
        <button className="back" onClick={() => setSel({ t: 'home' })}>‹ Back</button>
        <div className="profile">
          <div className="phead">
            <Avatar p={p} size={64} />
            <div>
              <h2>{p.display_name || 'Runner'}</h2>
              <div className="rankline">@{p.username || '—'} · {p.rank || 'Wanderer'} · Lv {p.level ?? 1}</div>
            </div>
          </div>
          <div className="statrow">
            <div className="st"><div className="n">{p.points ?? 0}</div><div className="l">points</div></div>
            <div className="st"><div className="n">Lv {p.level ?? 1}</div><div className="l">{p.rank || 'Wanderer'}</div></div>
          </div>
          <p className="s-note">Their runs & badges will show here once we open run-sharing between friends.</p>
        </div>
      </>
    );
  }

  return (
    <>
      {requests.length > 0 && (
        <>
          <div className="sec-title">Friend requests <span className="badge-count">{requests.length}</span></div>
          <div className="friends">
            {requests.map(r => (
              <div className="friendrow" key={r.fid}>
                <Avatar p={r.p} />
                <div className="fmid">
                  <div className="fname">{r.p.display_name || 'Runner'}</div>
                  <div className="fsub">@{r.p.username || '—'}</div>
                </div>
                <div className="req-actions">
                  <button className="btn-accept" disabled={busy === r.fid} onClick={() => accept(r.fid)}>Accept</button>
                  <button className="btn-decline" disabled={busy === r.fid} onClick={() => decline(r.fid)}>✕</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="sec-title">Add friends</div>
      <form className="s-search" onSubmit={search}>
        <span className="at">@</span>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="search by username" autoCapitalize="none" />
        <button type="submit">Search</button>
      </form>
      {results && (
        <div className="friends">
          {results.length === 0 && <div className="s-empty">No one found. Ask them for their exact @username.</div>}
          {results.map(p => {
            const already = friends.some(f => f.id === p.id);
            const sent = outgoing.has(p.id);
            return (
              <div className="friendrow" key={p.id}>
                <Avatar p={p} />
                <div className="fmid">
                  <div className="fname">{p.display_name || 'Runner'}</div>
                  <div className="fsub">@{p.username}</div>
                </div>
                {already ? <span className="tag-friend">Friends ✓</span>
                  : sent ? <span className="tag-sent">Requested</span>
                    : <button className="btn-add" disabled={busy === p.id} onClick={() => sendRequest(p.id)}>+ Add</button>}
              </div>
            );
          })}
        </div>
      )}

      <div className="sec-title">Friends {friends.length > 0 && <span className="hint">by points</span>}</div>
      {loading ? <div className="s-empty">Loading…</div>
        : friends.length === 0 ? <div className="s-empty">No friends yet — search a username above to send your first request. 🏃</div>
          : (
            <div className="friends">
              {friends.map(p => (
                <button className="friendrow" key={p.id} onClick={() => setSel({ t: 'friend', p })}>
                  <Avatar p={p} />
                  <div className="fmid">
                    <div className="fname">{p.display_name || 'Runner'}</div>
                    <div className="fsub">@{p.username || '—'} · {p.rank || 'Wanderer'}</div>
                  </div>
                  <div className="fright"><div className="fpts">{p.points ?? 0}</div><div className="fptl">points</div></div>
                  <span className="chev">›</span>
                </button>
              ))}
            </div>
          )}

      {err && <div className="s-err">{err}</div>}
    </>
  );
}
