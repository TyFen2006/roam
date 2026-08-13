import { useCallback, useEffect, useState } from 'react';
import FogMap from './FogMap.jsx';
import Social from './Social.jsx';
import RunMoods from './RunMoods.jsx';
import Auth from './Auth.jsx';
import Profile from './Profile.jsx';
import { supabase, hasSupabase } from './lib/supabase.js';
import { initials } from './lib/util.js';

const I = {
  map:   <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z M9 4v14 M15 6v14" />,
  social:<><circle cx="8.5" cy="8" r="3" /><path d="M3 20c0-3 2.4-5 5.5-5s5.5 2 5.5 5" /><circle cx="17" cy="9.5" r="2.4" /><path d="M15.5 15.2c2.4.1 4.5 1.9 4.5 4.8" /></>,
  start: <path d="M8 5v14l11-7z" fill="currentColor" stroke="none" />,
  board: <path d="M6 20V10 M12 20V4 M18 20v-7" />,
  you:   <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></>,
};

function Icon({ d }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{d}</svg>;
}

function Placeholder({ icon, title, text }) {
  return (
    <div className="placeholder">
      <div className="ic"><Icon d={icon} /></div>
      <h2>{title}</h2>
      <p>{text}</p>
      <span className="soon">next up</span>
    </div>
  );
}

const TABS = [
  { id: 'map',    label: 'Map' },
  { id: 'social', label: 'Social' },
  { id: 'start',  label: '' },
  { id: 'board',  label: 'Board' },
  { id: 'you',    label: 'You' },
];

export default function App() {
  const [tab, setTab] = useState('map');
  const [mood, setMood] = useState('Explore');
  const [session, setSession] = useState(hasSupabase ? undefined : null); // undefined = still loading
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    if (!hasSupabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const loadProfile = useCallback(() => {
    if (!session?.user) { setProfile(null); return; }
    supabase.from('profiles').select('display_name,username,avatar_url,rank,level').eq('id', session.user.id).single()
      .then(({ data }) => setProfile(data || null));
  }, [session]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  if (hasSupabase && session === undefined) {
    return <div className="app boot"><div className="boot-mark">ROAM</div></div>;
  }
  if (hasSupabase && !session) {
    return <Auth />;
  }

  const levelLabel = profile ? `${profile.rank || 'Wanderer'} · Lv ${profile.level ?? 1}` : 'Trailblazer · Lv 6';
  const ini = initials(profile?.display_name || session?.user?.email);

  return (
    <div className="app">
      <div className="topbar">
        <div>
          <div className="mk">ROAM</div>
          <div className="sub">running scored on fun, not pace</div>
        </div>
        <button className="topright" onClick={() => setTab('you')} aria-label="Your profile">
          <span className="lvl">{levelLabel}</span>
          <span className="avatar-sm">
            {profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : ini}
          </span>
        </button>
      </div>

      <div className="view">
        {tab === 'map' && <FogMap mood={mood} onEditMood={() => setTab('start')} />}
        {tab === 'social' && <Social />}
        {tab === 'start' && (
          <RunMoods mood={mood} onPick={(m) => { setMood(m); setTab('map'); }} />
        )}
        {tab === 'board' && (
          <Placeholder icon={I.board} title="Scoreboards"
            text="Local, friends, and community boards — competing on exploration and connection, not pace. Group boards already live inside Social." />
        )}
        {tab === 'you' && <Profile session={session} profile={profile} onUpdated={loadProfile} />}
      </div>

      <nav className="tabbar">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`tab ${t.id === 'start' ? 'start' : ''} ${tab === t.id ? 'on' : ''}`}
            onClick={() => setTab(t.id)}
            aria-label={t.label || 'Start a run'}
          >
            {t.id === 'start' ? (
              <span className="disc"><svg viewBox="0 0 24 24">{I.start}</svg></span>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{I[t.id]}</svg>
                {t.label}
              </>
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}
