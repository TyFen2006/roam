import { useCallback, useEffect, useState } from 'react';
import FogMap from './FogMap.jsx';
import CommunityMap from './CommunityMap.jsx';
import Social from './Social.jsx';
import RunMoods from './RunMoods.jsx';
import Auth from './Auth.jsx';
import Onboarding from './Onboarding.jsx';
import Profile from './Profile.jsx';
import Quests from './Quests.jsx';
import { supabase, hasSupabase } from './lib/supabase.js';
import { initials } from './lib/util.js';
import { stravaExchange } from './lib/strava.js';
import { levelFromPoints } from './lib/levels.js';
import { captureInvite, clearPendingInvite, acceptInvite, fetchInviterName } from './lib/invite.js';

const I = {
  map:   <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z M9 4v14 M15 6v14" />,
  social:<><circle cx="8.5" cy="8" r="3" /><path d="M3 20c0-3 2.4-5 5.5-5s5.5 2 5.5 5" /><circle cx="17" cy="9.5" r="2.4" /><path d="M15.5 15.2c2.4.1 4.5 1.9 4.5 4.8" /></>,
  start: <path d="M8 5v14l11-7z" fill="currentColor" stroke="none" />,
  quests:<><path d="M5 21V4" /><path d="M5 4c3-1.6 6 1.6 9 0v7c-3 1.6-6-1.6-9 0" /></>,
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
  { id: 'quests', label: 'Quests' },
  { id: 'you',    label: 'You' },
];

export default function App() {
  const [tab, setTab] = useState('map');
  const [mapView, setMapView] = useState('mine'); // 'mine' = personal fog map | 'world' = community map
  const [mood, setMood] = useState('Explore');
  const [session, setSession] = useState(hasSupabase ? undefined : null); // undefined = still loading
  const [profile, setProfile] = useState(null);
  const [showIntro, setShowIntro] = useState(() => !localStorage.getItem('roam.onboarded.v1'));
  const [pendingInvite, setPendingInvite] = useState(() => (hasSupabase ? captureInvite() : null));
  const [inviterName, setInviterName] = useState('');
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (!hasSupabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const loadProfile = useCallback(() => {
    if (!session?.user) { setProfile(null); return; }
    supabase.from('profiles').select('display_name,username,avatar_url,points,rank,level').eq('id', session.user.id).single()
      .then(({ data }) => setProfile(data || null));
  }, [session]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  // Someone arrived on an invite link but isn't signed in yet — greet them by
  // the inviter's name on the auth screen to boost sign-up.
  useEffect(() => {
    if (!hasSupabase || session || !pendingInvite) return;
    fetchInviterName(supabase, pendingInvite).then(n => n && setInviterName(n));
  }, [session, pendingInvite]);

  // Signed in with a pending invite → become friends automatically.
  useEffect(() => {
    if (!session?.user || !pendingInvite) return;
    acceptInvite(supabase, pendingInvite, session.user.id).then(res => {
      clearPendingInvite();
      setPendingInvite(null);
      if (res?.ok || res?.already) {
        if (res.name) setToast(`🎉 You're now friends with ${res.name}`);
        loadProfile();
      }
    });
  }, [session, pendingInvite]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-dismiss the toast.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // Handle the Strava OAuth redirect (?code=...) after the user connects.
  useEffect(() => {
    if (!session?.user) return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (!code) return;
    stravaExchange(code).then(async (t) => {
      if (t && t.access_token) {
        await supabase.from('strava_accounts').upsert({
          user_id: session.user.id,
          athlete_id: t.athlete?.id ?? null,
          access_token: t.access_token,
          refresh_token: t.refresh_token,
          expires_at: t.expires_at,
        });
        setTab('you');
      }
    }).finally(() => {
      window.history.replaceState({}, '', window.location.pathname);
    });
  }, [session]);

  if (hasSupabase && session === undefined) {
    return <div className="app boot"><div className="boot-mark">ROAM</div></div>;
  }
  if (hasSupabase && !session) {
    return <Auth inviterName={inviterName} />;
  }

  if (showIntro) {
    const finishIntro = (goStart) => {
      localStorage.setItem('roam.onboarded.v1', '1');
      setShowIntro(false);
      if (goStart) setTab('start');
    };
    return <Onboarding onDone={() => finishIntro(false)} onStart={() => finishIntro(true)} />;
  }

  const lv = levelFromPoints(profile?.points || 0);
  const levelLabel = profile ? `${lv.rank} · Lv ${lv.level}` : 'Wanderer · Lv 1';
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

      {toast && <div className="toast" role="status">{toast}</div>}

      <div className="view">
        {tab === 'map' && (
          <>
            <div className="map-switch">
              <button className={mapView === 'mine' ? 'on' : ''} onClick={() => setMapView('mine')}>My map</button>
              <button className={mapView === 'world' ? 'on' : ''} onClick={() => setMapView('world')}>Community</button>
            </div>
            {mapView === 'mine'
              ? <FogMap mood={mood} onEditMood={() => setTab('start')} userId={session?.user?.id} myName={profile?.display_name || session?.user?.email} />
              : <CommunityMap />}
          </>
        )}
        {tab === 'social' && <Social userId={session?.user?.id} />}
        {tab === 'start' && (
          <RunMoods mood={mood} onPick={(m) => { setMood(m); setTab('map'); }} />
        )}
        {tab === 'quests' && <Quests userId={session?.user?.id} onReward={loadProfile} />}
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
