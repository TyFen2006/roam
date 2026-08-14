import { useCallback, useEffect, useState } from 'react';
import { supabase } from './lib/supabase.js';
import { QUEST_REWARDS, PATCHES } from './lib/levels.js';
import './Quests.css';

function weekStart() {
  const d = new Date();
  const off = (d.getDay() + 6) % 7;      // Monday = start of week
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - off);
  return d;
}
function daysLeft() {
  const end = new Date(weekStart());
  end.setDate(end.getDate() + 7);
  return Math.max(1, Math.ceil((end - Date.now()) / 86400000));
}

export default function Quests({ userId, onReward }) {
  const [stats, setStats] = useState(null);
  const [claims, setClaims] = useState(new Set());
  const [justEarned, setJustEarned] = useState([]);
  const [err, setErr] = useState('');
  const unit = (() => { try { return localStorage.getItem('roam.unit') || 'mi'; } catch { return 'mi'; } })();
  const weekDate = weekStart().toISOString().slice(0, 10);

  const distTarget = unit === 'mi' ? 6 : 10;
  const buildQuests = (s) => [
    { id: 'spot', icon: '📍', title: "This week's spot", desc: 'Run to the pin on your map', v: s.spot ? 1 : 0, target: 1, binary: true },
    { id: 'streets', icon: '🗺️', title: 'Trailblazer', desc: 'Uncover 15 new streets', v: s.newStreets, target: 15 },
    { id: 'dist', icon: '🏃', title: 'Go the distance', desc: `Cover ${distTarget} ${unit}`, v: unit === 'mi' ? s.distanceKm * 0.621371 : s.distanceKm, target: distTarget, fmt: v => v.toFixed(1) },
    { id: 'freq', icon: '🔥', title: 'Keep it up', desc: 'Run 3 times', v: s.runCount, target: 3 },
    { id: 'sunrise', icon: '🌅', title: 'Sunrise Club', desc: 'Do a run before 8am', v: s.sunrise ? 1 : 0, target: 1, binary: true },
    { id: 'weekend', icon: '✨', title: 'Weekend wander', desc: 'Run on a weekend', v: s.weekend ? 1 : 0, target: 1, binary: true },
  ];

  const load = useCallback(async () => {
    if (!userId || !supabase) return;
    try {
      const [runsRes, claimsRes, spotRes] = await Promise.all([
        supabase.from('runs').select('distance_km,cells,created_at').eq('user_id', userId).gte('created_at', weekStart().toISOString()),
        supabase.from('quest_claims').select('quest_id').eq('user_id', userId).eq('week', weekDate),
        supabase.from('quest_spots').select('reached').eq('user_id', userId).eq('week', weekDate).maybeSingle(),
      ]);
      if (runsRes.error) throw runsRes.error;
      const runs = runsRes.data || [];
      const s = {
        newStreets: runs.reduce((a, r) => a + (r.cells || 0), 0),
        distanceKm: runs.reduce((a, r) => a + Number(r.distance_km || 0), 0),
        runCount: runs.length,
        sunrise: runs.some(r => new Date(r.created_at).getHours() < 8),
        weekend: runs.some(r => { const d = new Date(r.created_at).getDay(); return d === 0 || d === 6; }),
        spot: spotRes?.data?.reached || false,
      };
      const claimed = new Set((claimsRes.data || []).map(c => c.quest_id));

      // grant rewards for newly-completed, unclaimed quests (idempotent via PK)
      const newly = [];
      for (const q of buildQuests(s)) {
        if (q.v >= q.target && !claimed.has(q.id)) {
          const { error } = await supabase.from('quest_claims').insert({ user_id: userId, quest_id: q.id, week: weekDate });
          if (error) continue;
          const rw = QUEST_REWARDS[q.id];
          if (rw) {
            await supabase.rpc('increment_points', { amt: rw.points });
            if (rw.patch) await supabase.from('user_patches').insert({ user_id: userId, patch_key: rw.patch });
            claimed.add(q.id);
            newly.push({ title: q.title, points: rw.points, patch: rw.patch });
          }
        }
      }
      setStats(s); setClaims(claimed);
      if (newly.length) { setJustEarned(newly); onReward?.(); }
    } catch (e) { setErr(e.message || 'Could not load quests'); }
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const quests = stats ? buildQuests(stats) : [];
  const doneCount = quests.filter(q => q.v >= q.target).length;

  return (
    <div className="quests">
      {justEarned.length > 0 && (
        <div className="q-celebrate" onClick={() => setJustEarned([])}>
          <div className="q-celebrate-in">
            <div className="q-conf">🎉</div>
            <h3>Quest{justEarned.length > 1 ? 's' : ''} complete!</h3>
            {justEarned.map((e, i) => (
              <div className="q-reward-line" key={i}>
                <b>{e.title}</b> — +{e.points} pts{e.patch && <> · 🏅 {PATCHES[e.patch]?.label} patch</>}
              </div>
            ))}
            <button className="q-celebrate-btn">Nice!</button>
          </div>
        </div>
      )}

      <div className="q-head">
        <div>
          <h2>This week's quests</h2>
          <div className="q-sub">Fresh every week · resets in {daysLeft()} day{daysLeft() === 1 ? '' : 's'}</div>
        </div>
        <div className={`q-ring ${quests.length > 0 && doneCount === quests.length ? 'full' : ''}`}><b>{doneCount}</b><small>/{quests.length || 6}</small></div>
      </div>

      {err && <div className="q-err">{err}</div>}
      {!stats ? <div className="q-empty">Loading…</div> : (
        <div className="q-list">
          {quests.map(q => {
            const done = q.v >= q.target;
            const pct = Math.min(100, (q.v / q.target) * 100);
            const rw = QUEST_REWARDS[q.id];
            return (
              <div className={`q-card ${done ? 'done' : ''}`} key={q.id}>
                <div className="q-ic">{q.icon}</div>
                <div className="q-mid">
                  <div className="q-title">{q.title}{done && <span className="q-check">✓</span>}</div>
                  <div className="q-desc">{q.desc}</div>
                  {!q.binary && <div className="q-bar"><span style={{ width: pct + '%' }} /></div>}
                  {rw && <div className="q-reward">🏅 {PATCHES[rw.patch]?.label} · +{rw.points} pts</div>}
                </div>
                <div className="q-prog">
                  {q.binary ? (done ? 'Done' : '—') : `${q.fmt ? q.fmt(q.v) : Math.floor(q.v)}/${q.target}`}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <p className="q-note">Complete a quest to earn its patch + bonus points. Patches live in your You tab. 🏅</p>
    </div>
  );
}
