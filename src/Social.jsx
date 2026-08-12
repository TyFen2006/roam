import { useState } from 'react';
import './Social.css';

const MOOD_COL = { Together: '#e8a33d', Explore: '#7fb0b6', Scenic: '#3f8f6d', Chill: '#33a08f' };

const BADGES = {
  sunrise:  { label: 'Sunrise Club', col: '#f0a63c' },
  newfaces: { label: '10 New Faces', col: '#3f8f6d' },
  hood:     { label: 'Neighborhood', col: '#7fb0b6' },
  rain:     { label: 'Rain Run',     col: '#33a08f' },
  night:    { label: 'Night Owl',    col: '#8a7bd8' },
  trail:    { label: 'Trailblazer',  col: '#e8654f' },
};

const FRIENDS = [
  { id: 'maya', name: 'Maya Chen', ini: 'MC', col: '#e8a33d', rank: 'Cartographer', streak: 12, week: 640, terr: 41, streets: 210, faces: 22,
    runs: [
      { mood: 'Together', pts: 180, when: 'Today', note: 'Sunset loop with the crew 🌇' },
      { mood: 'Explore',  pts: 120, when: 'Tue',   note: 'New trail behind the mill' },
      { mood: 'Chill',    pts: 60,  when: 'Sun',   note: 'Easy recovery jog' },
    ], badges: ['sunrise', 'newfaces', 'hood', 'trail'] },
  { id: 'devin', name: 'Devin Ross', ini: 'DR', col: '#33a08f', rank: 'Trailblazer', streak: 5, week: 498, terr: 33, streets: 168, faces: 14,
    runs: [
      { mood: 'Explore', pts: 140, when: 'Today', note: 'Colored in 4 new streets' },
      { mood: 'Scenic',  pts: 90,  when: 'Mon',   note: 'Coastal route, unreal views' },
    ], badges: ['hood', 'rain', 'trail'] },
  { id: 'priya', name: 'Priya Shah', ini: 'PS', col: '#8a7bd8', rank: 'Ringleader', streak: 20, week: 410, terr: 28, streets: 140, faces: 31,
    runs: [
      { mood: 'Together', pts: 200, when: 'Today', note: 'Brought two first-timers! 🎉' },
      { mood: 'Together', pts: 110, when: 'Wed',   note: 'Group run downtown' },
    ], badges: ['newfaces', 'night', 'sunrise'] },
  { id: 'jake', name: 'Jake Miller', ini: 'JM', col: '#7fb0b6', rank: 'Pathfinder', streak: 3, week: 360, terr: 22, streets: 96, faces: 9,
    runs: [
      { mood: 'Chill',  pts: 70, when: 'Today', note: 'Slow miles, big talks' },
      { mood: 'Night',  pts: 80, when: 'Thu',   note: 'Late night neon run' },
    ], badges: ['night', 'trail'] },
];

const GROUPS = [
  { id: 'unh', name: 'UNH Running Club', emoji: '🐾', col: '#3d6fe0', members: 42, joined: true, blurb: 'Wildcats who run for fun',
    board: [ ['Maya C.', 640], ['You', 520], ['Devin R.', 498], ['Priya S.', 410], ['Jake M.', 360] ] },
  { id: 'sunday', name: 'Sunday Long Run Crew', emoji: '🌅', col: '#e0793a', members: 8, joined: true, blurb: 'Weekend warriors, coffee after',
    board: [ ['You', 300], ['Priya S.', 280], ['Maya C.', 240], ['Sam T.', 180] ] },
  { id: 'durham', name: 'Durham Community', emoji: '🏘️', col: '#33a08f', members: 211, joined: false, blurb: 'Everyone exploring Durham, NH',
    board: [ ['Alex P.', 910], ['Maya C.', 640], ['Nora B.', 590], ['You', 520], ['Devin R.', 498] ] },
];

function badgeIcon(k) {
  const c = BADGES[k].col;
  switch (k) {
    case 'sunrise':  return <><path d="M10 26a10 10 0 0 1 20 0" fill="none" stroke={c} strokeWidth="2.4" /><path d="M20 6v6M9 12l3 3M31 12l-3 3M4 26h32" stroke={c} strokeWidth="2.4" strokeLinecap="round" /></>;
    case 'newfaces': return <><circle cx="15" cy="16" r="4" stroke={c} strokeWidth="2.4" fill="none" /><circle cx="25" cy="18" r="3.2" stroke={c} strokeWidth="2.4" fill="none" /><path d="M8 32c1-5 4-7 7-7s6 2 7 6M22 31c1-4 3-5 5-5s4 1 5 5" stroke={c} strokeWidth="2.2" fill="none" strokeLinecap="round" /></>;
    case 'hood':     return <><path d="M9 18l11-6 11 6v13H9z" fill="none" stroke={c} strokeWidth="2.4" strokeLinejoin="round" /><path d="M20 12v19" stroke={c} strokeWidth="1.6" /><path d="M13 24c3 0 4-3 7-3s4 3 7 3" stroke={c} strokeWidth="2" fill="none" strokeLinecap="round" /></>;
    case 'rain':     return <path d="M20 7c-6 9-9 13-9 18a9 9 0 0 0 18 0c0-5-3-9-9-18z" fill="none" stroke={c} strokeWidth="2.4" />;
    case 'night':    return <path d="M26 20a8 8 0 1 1-8-8 6.5 6.5 0 0 0 8 8z" fill="none" stroke={c} strokeWidth="2.4" strokeLinejoin="round" />;
    default:         return <path d="M20 6l4 8 9 1-6.5 6.3 1.5 9L20 26l-8 4.3 1.5-9L7 15l9-1z" fill="none" stroke={c} strokeWidth="2.4" strokeLinejoin="round" />;
  }
}

function Badge({ k }) {
  return (
    <div className="badge" title={BADGES[k].label}>
      <svg viewBox="0 0 40 40" style={{ '--bc': BADGES[k].col }}>
        <circle cx="20" cy="20" r="18" fill="rgba(255,255,255,.02)" stroke="var(--bc)" strokeWidth="1.5" opacity=".5" />
        {badgeIcon(k)}
      </svg>
      <span>{BADGES[k].label}</span>
    </div>
  );
}

function Avatar({ f, size = 46 }) {
  return <div className="avatar" style={{ width: size, height: size, background: `linear-gradient(150deg, ${f.col}, ${f.col}22)`, borderColor: f.col }}>{f.ini}</div>;
}

export default function Social() {
  const [sel, setSel] = useState({ t: 'home' });
  const [joined, setJoined] = useState(() => Object.fromEntries(GROUPS.map(g => [g.id, g.joined])));

  if (sel.t === 'friend') {
    const f = FRIENDS.find(x => x.id === sel.id);
    return (
      <div className="social">
        <button className="back" onClick={() => setSel({ t: 'home' })}>‹ Back</button>
        <div className="profile">
          <div className="phead">
            <Avatar f={f} size={64} />
            <div>
              <h2>{f.name}</h2>
              <div className="rankline"><span className="rank">{f.rank}</span> · 🔥 {f.streak}-day streak</div>
            </div>
          </div>
          <div className="statrow">
            <div className="st"><div className="n">{f.streets}</div><div className="l">streets</div></div>
            <div className="st"><div className="n">{f.terr}%</div><div className="l">of Durham</div></div>
            <div className="st"><div className="n">{f.faces}</div><div className="l">new faces</div></div>
            <div className="st"><div className="n">{f.week}</div><div className="l">pts / wk</div></div>
          </div>

          <div className="sec-title">Recent runs</div>
          <div className="runlist">
            {f.runs.map((r, i) => (
              <div className="runrow" key={i}>
                <span className="dot" style={{ background: MOOD_COL[r.mood] || '#8a7bd8' }} />
                <div className="rmid"><div className="rmood">{r.mood} run</div><div className="rnote">{r.note}</div></div>
                <div className="rright"><div className="rpts">+{r.pts}</div><div className="rwhen">{r.when}</div></div>
              </div>
            ))}
          </div>

          <div className="sec-title">Patches · {f.badges.length}</div>
          <div className="badges">{f.badges.map(b => <Badge k={b} key={b} />)}</div>
        </div>
      </div>
    );
  }

  if (sel.t === 'group') {
    const g = GROUPS.find(x => x.id === sel.id);
    const isJoined = joined[g.id];
    return (
      <div className="social">
        <button className="back" onClick={() => setSel({ t: 'home' })}>‹ Back</button>
        <div className="gdetail">
          <div className="ghead" style={{ '--gc': g.col }}>
            <div className="gemoji">{g.emoji}</div>
            <div>
              <h2>{g.name}</h2>
              <div className="gsub">{g.members} members · {g.blurb}</div>
            </div>
          </div>
          <button className={`joinbtn ${isJoined ? 'in' : ''}`} onClick={() => setJoined({ ...joined, [g.id]: !isJoined })}>
            {isJoined ? '✓ Joined' : '+ Join group'}
          </button>

          <div className="sec-title">This week · fun points</div>
          <div className="board">
            {g.board.map(([name, pts], i) => (
              <div className={`brow ${name === 'You' ? 'me' : ''}`} key={i}>
                <span className="brank">{i + 1}</span>
                <span className="bname">{name}</span>
                <span className="bbar"><span style={{ width: (pts / g.board[0][1] * 100) + '%', background: g.col }} /></span>
                <span className="bpts">{pts}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // home
  return (
    <div className="social">
      <div className="sec-title">Your groups <span className="hint">be in as many as you like</span></div>
      <div className="groups">
        {GROUPS.map(g => (
          <button className="gcard" key={g.id} style={{ '--gc': g.col }} onClick={() => setSel({ t: 'group', id: g.id })}>
            <div className="gcard-top"><span className="gemoji">{g.emoji}</span>{joined[g.id] && <span className="tag-in">Joined</span>}</div>
            <div className="gcard-name">{g.name}</div>
            <div className="gcard-meta">{g.members} members</div>
          </button>
        ))}
        <button className="gcard join" onClick={() => setSel({ t: 'home' })}>
          <div className="plus">+</div>
          <div className="gcard-name">Join or create</div>
          <div className="gcard-meta">community · crew · team</div>
        </button>
      </div>

      <div className="sec-title">Friends</div>
      <div className="friends">
        {FRIENDS.map(f => (
          <button className="friendrow" key={f.id} onClick={() => setSel({ t: 'friend', id: f.id })}>
            <Avatar f={f} />
            <div className="fmid">
              <div className="fname">{f.name}</div>
              <div className="fsub"><span className="rank">{f.rank}</span> · 🔥 {f.streak}d</div>
            </div>
            <div className="fright"><div className="fpts">{f.week}</div><div className="fptl">pts / wk</div></div>
            <span className="chev">›</span>
          </button>
        ))}
      </div>
    </div>
  );
}
