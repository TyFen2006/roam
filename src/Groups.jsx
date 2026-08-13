import { useCallback, useEffect, useState } from 'react';
import { supabase } from './lib/supabase.js';

function GroupRow({ g, count, joined, onOpen }) {
  return (
    <button className="grow" onClick={onOpen}>
      <div className="gemoji-sm">{g.emoji || '🏃'}</div>
      <div className="fmid">
        <div className="fname">{g.name}{joined && <span className="tag-friend"> ✓</span>}</div>
        <div className="fsub">{count} member{count === 1 ? '' : 's'}{g.blurb ? ' · ' + g.blurb : ''}</div>
      </div>
      <span className="chev">›</span>
    </button>
  );
}

export default function Groups({ userId }) {
  const [view, setView] = useState('list');   // 'list' | 'create' | { t:'detail', g }
  const [groups, setGroups] = useState([]);
  const [counts, setCounts] = useState({});
  const [mine, setMine] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [form, setForm] = useState({ name: '', emoji: '🏃', blurb: '' });
  const [board, setBoard] = useState(null);

  const load = useCallback(async () => {
    if (!userId || !supabase) return;
    setLoading(true); setErr('');
    try {
      const [{ data: gs, error: ge }, { data: gm, error: me }] = await Promise.all([
        supabase.from('groups').select('id,name,emoji,blurb,created_by').order('created_at', { ascending: false }),
        supabase.from('group_members').select('group_id,user_id'),
      ]);
      if (ge) throw ge; if (me) throw me;
      const c = {}; const mineSet = new Set();
      (gm || []).forEach(r => { c[r.group_id] = (c[r.group_id] || 0) + 1; if (r.user_id === userId) mineSet.add(r.group_id); });
      setGroups(gs || []); setCounts(c); setMine(mineSet);
    } catch (e) { setErr(e.message || 'Could not load groups'); }
    finally { setLoading(false); }
  }, [userId]);
  useEffect(() => { load(); }, [load]);

  async function createGroup(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setBusy(true); setErr('');
    try {
      const { data, error } = await supabase.from('groups')
        .insert({ name: form.name.trim(), emoji: form.emoji.trim() || '🏃', blurb: form.blurb.trim() || null, created_by: userId })
        .select('id,name,emoji,blurb,created_by').single();
      if (error) throw error;
      await supabase.from('group_members').insert({ group_id: data.id, user_id: userId });
      setForm({ name: '', emoji: '🏃', blurb: '' });
      await load();
      openDetail(data);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }

  async function join(gid) { setBusy(true); await supabase.from('group_members').insert({ group_id: gid, user_id: userId }); setMine(new Set([...mine, gid])); await load(); setBusy(false); }
  async function leave(gid) { setBusy(true); await supabase.from('group_members').delete().eq('group_id', gid).eq('user_id', userId); const n = new Set(mine); n.delete(gid); setMine(n); await load(); setBusy(false); }

  async function openDetail(g) {
    setView({ t: 'detail', g }); setBoard(null);
    const { data: gm } = await supabase.from('group_members').select('user_id').eq('group_id', g.id);
    const ids = (gm || []).map(r => r.user_id);
    if (!ids.length) { setBoard([]); return; }
    const { data: profs } = await supabase.from('profiles').select('id,display_name,username,points').in('id', ids);
    setBoard((profs || []).slice().sort((a, b) => (b.points || 0) - (a.points || 0)));
  }

  // ---- detail ----
  if (view.t === 'detail') {
    const g = view.g;
    const joined = mine.has(g.id);
    const max = board && board[0] ? Math.max(1, board[0].points || 0) : 1;
    return (
      <>
        <button className="back" onClick={() => { setView('list'); load(); }}>‹ Back</button>
        <div className="gdetail">
          <div className="ghead" style={{ '--gc': 'var(--marigold)' }}>
            <div className="gemoji">{g.emoji || '🏃'}</div>
            <div><h2>{g.name}</h2><div className="gsub">{counts[g.id] || 0} members · {g.blurb || 'A Roam crew'}</div></div>
          </div>
          <button className={`joinbtn ${joined ? 'in' : ''}`} disabled={busy} onClick={() => (joined ? leave(g.id) : join(g.id))}>
            {joined ? '✓ Joined — tap to leave' : '+ Join group'}
          </button>
          <div className="sec-title">Leaderboard <span className="hint">by points</span></div>
          {board == null ? <div className="s-empty">Loading…</div>
            : board.length === 0 ? <div className="s-empty">No members yet.</div>
              : (
                <div className="board">
                  {board.map((p, i) => (
                    <div className={`brow ${p.id === userId ? 'me' : ''}`} key={p.id}>
                      <span className="brank">{i + 1}</span>
                      <span className="bname">{p.id === userId ? 'You' : (p.display_name || p.username || 'Runner')}</span>
                      <span className="bbar"><span style={{ width: ((p.points || 0) / max * 100) + '%', background: 'var(--marigold)' }} /></span>
                      <span className="bpts">{p.points ?? 0}</span>
                    </div>
                  ))}
                </div>
              )}
        </div>
      </>
    );
  }

  // ---- create ----
  if (view === 'create') {
    return (
      <>
        <button className="back" onClick={() => setView('list')}>‹ Back</button>
        <form className="g-create" onSubmit={createGroup}>
          <div className="sec-title">Create a group</div>
          <label className="fld"><span>Emoji</span><input value={form.emoji} onChange={e => setForm({ ...form, emoji: e.target.value })} maxLength={2} /></label>
          <label className="fld"><span>Name</span><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="UNH Running Club" /></label>
          <label className="fld"><span>About</span><input value={form.blurb} onChange={e => setForm({ ...form, blurb: e.target.value })} placeholder="Wildcats who run for fun" /></label>
          {err && <div className="s-err">{err}</div>}
          <button className="pe-save" disabled={busy || !form.name.trim()} type="submit">{busy ? '…' : 'Create group'}</button>
        </form>
      </>
    );
  }

  // ---- list ----
  const myGroups = groups.filter(g => mine.has(g.id));
  const other = groups.filter(g => !mine.has(g.id));
  return (
    <>
      <button className="g-createbtn" onClick={() => setView('create')}>+ Create a group</button>

      <div className="sec-title">Your groups</div>
      {loading ? <div className="s-empty">Loading…</div>
        : myGroups.length === 0 ? <div className="s-empty">Not in any groups yet — create one, or join below. 👥</div>
          : <div className="glist">{myGroups.map(g => <GroupRow key={g.id} g={g} count={counts[g.id] || 0} joined onOpen={() => openDetail(g)} />)}</div>}

      <div className="sec-title">Discover</div>
      {loading ? null
        : other.length === 0 ? <div className="s-empty">No other groups yet — be the first to make one.</div>
          : <div className="glist">{other.map(g => <GroupRow key={g.id} g={g} count={counts[g.id] || 0} onOpen={() => openDetail(g)} />)}</div>}

      {err && <div className="s-err">{err}</div>}
    </>
  );
}
