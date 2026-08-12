import './RunMoods.css';

const MOODS = [
  { id: 'Together', tint: '#e8a33d', desc: 'Points for company — extra for someone new.',
    icon: <><circle cx="9" cy="9" r="3.4" /><circle cx="17" cy="10" r="2.8" /><path d="M3.5 21c.6-4 3.2-6 5.5-6s5 2 5.5 6M15 15.2c2.3.1 4.2 1.9 4.5 5" /></> },
  { id: 'Explore', tint: '#7fb0b6', desc: 'Uncover new streets and fill in your fog map.',
    icon: <><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z M9 4v14 M15 6v14" /></> },
  { id: 'Scenic', tint: '#3f8f6d', desc: 'Chase views and landmarks — take the long way.',
    icon: <><path d="M3 20l6-9 4 5 3-4 5 8z" /><circle cx="17.5" cy="6.5" r="2" /></> },
  { id: 'Chill', tint: '#33a08f', desc: 'Effort, not pace. A relaxed, no-pressure run.',
    icon: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></> },
];

export default function RunMoods({ mood, onPick }) {
  return (
    <div className="runmoods">
      <div className="rm-head">
        <div className="rm-eyebrow">Start a run</div>
        <h2>What's this run about?</h2>
        <p>Your mood sets what Roam scores — and it'll suggest a matching route.</p>
      </div>

      <div className="rm-list">
        {MOODS.map(m => (
          <button
            key={m.id}
            className={`rm-card ${mood === m.id ? 'sel' : ''}`}
            style={{ '--t': m.tint }}
            onClick={() => onPick(m.id)}
          >
            <span className="rm-ic">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{m.icon}</svg>
            </span>
            <span className="rm-txt">
              <span className="rm-title">{m.id}{mood === m.id && <span className="rm-cur">current</span>}</span>
              <span className="rm-desc">{m.desc}</span>
            </span>
            <span className="rm-go">›</span>
          </button>
        ))}
      </div>

      <p className="rm-foot">Pick one — Roam drops you on the map to start the run.</p>
    </div>
  );
}
