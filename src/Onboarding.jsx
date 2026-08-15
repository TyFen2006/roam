import { useState, useRef } from 'react';
import './Onboarding.css';

/* ---- slide artwork (inline SVG so it matches the theme + needs no assets) ---- */

function ArtPitch() {
  return (
    <svg className="ob-art" viewBox="0 0 220 150" fill="none">
      <circle cx="110" cy="66" r="30" stroke="var(--marigold)" strokeWidth="2.5" />
      <path d="M110 40v26l16 10" stroke="var(--marigold-2)" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M40 120c14 0 14-8 28-8s14 8 28 8 14-8 28-8 14 8 28 8" stroke="var(--teal)" strokeWidth="2" strokeLinecap="round" opacity=".7" />
      <text x="110" y="140" textAnchor="middle" className="ob-art-x">— your time? — nah.</text>
    </svg>
  );
}

function ArtCurrencies() {
  return (
    <svg className="ob-art" viewBox="0 0 220 150" fill="none">
      {/* connection */}
      <g transform="translate(38 46)" stroke="var(--marigold)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="0" cy="-4" r="5" /><circle cx="14" cy="-2" r="4" />
        <path d="M-9 18c1-7 5-10 9-10M2 18c1-8 6-11 12-9" />
      </g>
      {/* exploration */}
      <g transform="translate(96 40)" stroke="var(--teal)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 0 0 3v20l8-3 8 3 8-3V0l-8 3-8-3z M8 0v20 M16 3v20" />
      </g>
      {/* vibe */}
      <g transform="translate(158 44)" stroke="var(--pine)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="8" cy="8" r="10" /><path d="M3 9s2 4 5 4 5-4 5-4M5 5h.01M11 5h.01" />
      </g>
      <text x="46" y="92" textAnchor="middle" className="ob-art-lbl">CONNECT</text>
      <text x="110" y="92" textAnchor="middle" className="ob-art-lbl">EXPLORE</text>
      <text x="174" y="92" textAnchor="middle" className="ob-art-lbl">VIBE</text>
    </svg>
  );
}

function ArtMap() {
  return (
    <svg className="ob-art" viewBox="0 0 220 150" fill="none">
      <defs>
        <radialGradient id="obReveal" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#0a0e12" stopOpacity="0" />
          <stop offset="70%" stopColor="#0a0e12" stopOpacity="0" />
          <stop offset="100%" stopColor="#0a0e12" stopOpacity=".85" />
        </radialGradient>
      </defs>
      {/* street grid */}
      <g stroke="var(--line)" strokeWidth="1">
        {[24, 54, 84, 114, 144].map(y => <line key={y} x1="10" y1={y} x2="210" y2={y} />)}
        {[30, 70, 110, 150, 190].map(x => <line key={x} x1={x} y1="10" x2={x} y2="150" />)}
      </g>
      {/* glowing trail */}
      <path d="M40 130 C70 120 66 86 96 82 S150 70 150 44 172 26 186 28"
        stroke="var(--marigold)" strokeWidth="3.5" strokeLinecap="round" opacity=".95" style={{ filter: 'drop-shadow(0 0 5px var(--marigold))' }} />
      <circle cx="186" cy="28" r="4.5" fill="var(--marigold-2)" />
      {/* fog closing in at edges */}
      <rect x="0" y="0" width="220" height="150" fill="url(#obReveal)" />
    </svg>
  );
}

function ArtCrew() {
  return (
    <svg className="ob-art" viewBox="0 0 220 150" fill="none">
      {/* owned street cells */}
      <g>
        <rect x="34" y="40" width="26" height="26" rx="4" fill="var(--marigold)" opacity=".85" />
        <rect x="64" y="40" width="26" height="26" rx="4" fill="var(--marigold)" opacity=".55" />
        <rect x="34" y="70" width="26" height="26" rx="4" fill="var(--marigold)" opacity=".55" />
        <rect x="130" y="56" width="26" height="26" rx="4" fill="#c9534a" opacity=".8" />
        <rect x="160" y="56" width="26" height="26" rx="4" fill="#c9534a" opacity=".5" />
      </g>
      <text x="60" y="112" textAnchor="middle" className="ob-art-lbl" style={{ fill: 'var(--marigold-2)' }}>YOURS</text>
      <text x="160" y="112" textAnchor="middle" className="ob-art-lbl" style={{ fill: '#e08a80' }}>STOLEN</text>
    </svg>
  );
}

const SLIDES = [
  {
    art: <ArtPitch />,
    eyebrow: 'Welcome to Roam',
    title: 'Running, scored on fun.',
    body: 'After a race, everyone asks "what was your time?" — never "was it fun?" Roam flips that. You earn points for the stuff that actually makes running feel good.',
  },
  {
    art: <ArtCurrencies />,
    eyebrow: 'How you score',
    title: 'Three ways to earn.',
    body: 'Connection for running with people (jackpot for someone new). Exploration for uncovering fresh streets. Vibe for a great run — themed, scenic, or just chill. Not a single pace stat in sight.',
  },
  {
    art: <ArtMap />,
    eyebrow: 'Your map',
    title: 'The world fills in as you run.',
    body: 'Every street you touch clears the fog. Your runs leave a glowing trail — a personal map of everywhere you\'ve been that grows into real, frame-worthy artwork.',
  },
  {
    art: <ArtCrew />,
    eyebrow: 'With your crew',
    title: 'Claim streets. Chase quests.',
    body: 'Own the blocks you run — until a friend out-runs you and steals them back. Take on weekly quests, earn patches, and climb the board together.',
    cta: 'Pick your first run',
  },
];

export default function Onboarding({ onDone, onStart }) {
  const [i, setI] = useState(0);
  const touch = useRef(null);
  const last = i === SLIDES.length - 1;
  const s = SLIDES[i];

  const go = (n) => setI(Math.max(0, Math.min(SLIDES.length - 1, n)));
  const next = () => (last ? (onStart || onDone)() : go(i + 1));

  const onTouchStart = (e) => { touch.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    if (touch.current == null) return;
    const dx = e.changedTouches[0].clientX - touch.current;
    if (dx < -45) next();
    else if (dx > 45) go(i - 1);
    touch.current = null;
  };

  return (
    <div className="onboard" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <button className="ob-skip" onClick={onDone}>Skip</button>

      <div className="ob-stage" key={i}>
        <div className="ob-artwrap">{s.art}</div>
        <div className="ob-eyebrow">{s.eyebrow}</div>
        <h1 className="ob-title">{s.title}</h1>
        <p className="ob-body">{s.body}</p>
      </div>

      <div className="ob-foot">
        <div className="ob-dots">
          {SLIDES.map((_, n) => (
            <button
              key={n}
              className={`ob-dot ${n === i ? 'on' : ''}`}
              onClick={() => go(n)}
              aria-label={`Slide ${n + 1}`}
            />
          ))}
        </div>
        <button className="ob-next" onClick={next}>
          {s.cta || (last ? 'Start' : 'Next')}
        </button>
      </div>
    </div>
  );
}
