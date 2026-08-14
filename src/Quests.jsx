import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase.js';
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

export default function Quests({ userId }) {
  const [stats, setStats] = useState(null);
  const [err, setErr] = useState('');
  const unit = (() => { try { return localStorage.getItem('roam.unit') || 'mi'; } catch { return 'mi'; } })();

  useEffect(() => {
    if (!userId || !supabase) return;
    supabase.from('runs').select('distance_km,cells,created_at')
      .eq('user_id', userId).gte('created_at', weekStart().toISOString())
      .then(({ data, error }) => {
        if (error) { setErr(error.message); return; }
        const runs = data || [];
        setStats({
          newStreets: runs.reduce((a, r) => a + (r.cells || 0), 0),
          distanceKm: runs.reduce((a, r) => a + Number(r.distance_km || 0), 0),
          runCount: runs.length,
          sunrise: runs.some(r => new Date(r.created_at).getHours() < 8),
          weekend: runs.some(r => { const d = new Date(r.created_at).getDay(); return d === 0 || d === 6; }),
        });
      });
  }, [userId]);

  const distTarget = unit === 'mi' ? 6 : 10;
  const quests = stats ? [
    { id: 'streets', icon: '🗺️', title: 'Trailblazer', desc: 'Uncover 15 new streets', v: stats.newStreets, target: 15, unit: 'streets' },
    { id: 'dist', icon: '🏃', title: 'Go the distance', desc: `Cover ${distTarget} ${unit}`, v: unit === 'mi' ? stats.distanceKm * 0.621371 : stats.distanceKm, target: distTarget, fmt: v => v.toFixed(1) },
    { id: 'freq', icon: '🔥', title: 'Keep it up', desc: 'Run 3 times', v: stats.runCount, target: 3 },
    { id: 'sunrise', icon: '🌅', title: 'Sunrise Club', desc: 'Do a run before 8am', v: stats.sunrise ? 1 : 0, target: 1, binary: true },
    { id: 'weekend', icon: '✨', title: 'Weekend wander', desc: 'Run on a weekend', v: stats.weekend ? 1 : 0, target: 1, binary: true },
  ] : [];
  const doneCount = quests.filter(q => q.v >= q.target).length;

  return (
    <div className="quests">
      <div className="q-head">
        <div>
          <h2>This week's quests</h2>
          <div className="q-sub">Fresh every week · resets in {daysLeft()} day{daysLeft() === 1 ? '' : 's'}</div>
        </div>
        <div className={`q-ring ${doneCount === 5 ? 'full' : ''}`}><b>{doneCount}</b><small>/5</small></div>
      </div>

      {err && <div className="q-err">{err}</div>}
      {!stats ? <div className="q-empty">Loading…</div> : (
        <div className="q-list">
          {quests.map(q => {
            const done = q.v >= q.target;
            const pct = Math.min(100, (q.v / q.target) * 100);
            return (
              <div className={`q-card ${done ? 'done' : ''}`} key={q.id}>
                <div className="q-ic">{q.icon}</div>
                <div className="q-mid">
                  <div className="q-title">{q.title}{done && <span className="q-check">✓</span>}</div>
                  <div className="q-desc">{q.desc}</div>
                  {!q.binary && <div className="q-bar"><span style={{ width: pct + '%' }} /></div>}
                </div>
                <div className="q-prog">
                  {q.binary ? (done ? 'Done' : '—') : `${q.fmt ? q.fmt(q.v) : Math.floor(q.v)}/${q.target}`}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <p className="q-note">Completing quests will earn badges & bonus points soon — for now, chase those ✓'s. 🏅</p>
    </div>
  );
}
