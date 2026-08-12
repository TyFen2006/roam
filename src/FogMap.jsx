import { useEffect, useRef, useState } from 'react';
import './FogMap.css';

const W = 960, H = 600, GS = 80;

const LM = [
  { x: 400, y: 320, name: 'Cup of Joe', pts: 50, col: '#e8a33d' },
  { x: 620, y: 250, name: 'College Woods', pts: 40, col: '#3f8f6d' },
  { x: 700, y: 430, name: 'Mill Pond', pts: 30, col: '#33a08f' },
];

const RUNS = [
  [[160,520],[160,320],[400,320],[400,160],[560,160],[560,240],[720,240]],
  [[400,320],[400,480],[640,480],[640,360],[800,360]],
  [[240,400],[240,240],[560,240],[560,80]],
  [[720,240],[720,430],[700,430],[500,430],[320,430],[320,520]],
];

const MOOD = {
  Together: { street: 1,   lm: 1,   tint: '#e8a33d', blurb: 'connection ×2',  bonus: 50 },
  Explore:  { street: 1.6, lm: 1,   tint: '#7fb0b6', blurb: 'new ground',     bonus: 0 },
  Scenic:   { street: 1,   lm: 1.6, tint: '#3f8f6d', blurb: 'views',          bonus: 0 },
  Chill:    { street: 1,   lm: 1,   tint: '#33a08f', blurb: 'effort not pace', bonus: 0 },
};

const STORE_KEY = 'roam.map.v1';

export default function FogMap({ mood = 'Explore', onEditMood }) {
  const mapRef = useRef(null), trailRef = useRef(null), fogRef = useRef(null), fxRef = useRef(null);
  const S = useRef({
    ctx: {}, runs: [], cur: [], visited: new Set(), found: new Set(),
    streets: 0, pts: 0, playing: false, raf: 0, route: null, seg: 0, segT: 0,
    prev: null, runIdx: 0, geoId: null, origin: null,
  });
  const [hud, setHud] = useState({ streets: 0, pct: 0, pts: 0 });
  const [status, setStatus] = useState('idle'); // idle | demo | gps
  const [toast, setToast] = useState(null);

  // ---------- drawing helpers ----------
  const line = (c, x1, y1, x2, y2, col, w) => { c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); };
  const dot = (c, x, y, r, col) => { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); };
  const ring = (c, x, y, r, col) => { c.strokeStyle = col; c.lineWidth = 2; c.beginPath(); c.arc(x, y, r, 0, 7); c.stroke(); };

  function drawMap() {
    const c = S.current.ctx.map;
    c.clearRect(0, 0, W, H);
    c.fillStyle = '#12171e'; c.fillRect(0, 0, W, H);
    // park
    c.fillStyle = '#1e3a2a';
    c.beginPath(); c.moveTo(560,150); c.quadraticCurveTo(700,140,730,240); c.quadraticCurveTo(660,258,600,247); c.quadraticCurveTo(540,200,560,150); c.closePath(); c.fill();
    // river + pond
    const river = () => { c.beginPath(); c.moveTo(120,470); c.bezierCurveTo(300,445,380,485,500,468); c.bezierCurveTo(620,452,700,478,860,462); c.stroke(); };
    c.strokeStyle = '#16333e'; c.lineWidth = 20; c.lineCap = 'round'; river();
    c.strokeStyle = '#265159'; c.lineWidth = 5; river();
    c.fillStyle = '#16333e'; c.beginPath(); c.ellipse(700,430,44,28,0,0,7); c.fill();
    // streets
    for (let x = GS; x < W; x += GS) line(c, x, 40, x, H-40, x % 240 === 0 ? '#465360' : '#333e49', x % 240 === 0 ? 3.2 : 2.4);
    for (let y = GS; y < H; y += GS) line(c, 40, y, W-40, y, y % 240 === 0 ? '#465360' : '#333e49', y % 240 === 0 ? 3.2 : 2.4);
    LM.forEach(l => dot(c, l.x, l.y, 4, '#3a4656'));
  }

  function fillFog() {
    const c = S.current.ctx.fog;
    c.globalCompositeOperation = 'source-over';
    c.clearRect(0, 0, W, H);
    c.fillStyle = 'rgba(8,11,17,0.8)';
    c.fillRect(0, 0, W, H);
  }

  // radial gradient stamp with custom [offset, alpha] stops
  function softStops(c, x, y, r, stops) {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    for (const [o, a] of stops) g.addColorStop(o, `rgba(0,0,0,${a})`);
    c.fillStyle = g;
    c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
  }

  // Lift the fog as a smooth gradient that dims outward from the route: a small
  // strong core keeps the path clear, then a wide, faint halo fades gently all
  // the way to full fog — no hard edge, no "blocky" boundary, just gradual dimming.
  function erode(x, y) {
    const c = S.current.ctx.fog;
    c.globalCompositeOperation = 'destination-out';
    c.filter = 'blur(6px)';
    softStops(c, x, y, 56, [[0, 0.85], [0.45, 0.5], [0.8, 0.16], [1, 0]]);
    softStops(c, x, y, 138, [[0, 0.15], [0.45, 0.08], [0.75, 0.03], [1, 0]]);
    c.filter = 'none';
  }

  function trailSeg(x1, y1, x2, y2) {
    const c = S.current.ctx.trail;
    c.globalCompositeOperation = 'source-over';
    c.strokeStyle = '#f4c877'; c.lineWidth = 5; c.lineCap = 'round'; c.lineJoin = 'round';
    c.shadowColor = 'rgba(232,163,61,.9)'; c.shadowBlur = 14;
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
    c.shadowBlur = 0;
  }

  function drawRunner(x, y, done, t) {
    const c = S.current.ctx.fx;
    c.clearRect(0, 0, W, H);
    if (!done) {
      const pr = 8 + (Math.sin(t) * 0.5 + 0.5) * 12;
      c.strokeStyle = 'rgba(244,200,119,' + (0.5 * (1 - (pr - 8) / 12)) + ')'; c.lineWidth = 2.5;
      c.beginPath(); c.arc(x, y, pr, 0, 7); c.stroke();
    }
    c.fillStyle = '#f4c877'; c.strokeStyle = '#181206'; c.lineWidth = 2;
    c.beginPath(); c.arc(x, y, 7, 0, 7); c.fill(); c.stroke();
  }

  function refreshHud() {
    const s = S.current;
    setHud({ streets: s.streets, pts: s.pts, pct: Math.min(100, Math.round(s.visited.size / 40 * 100)) });
  }

  // A "Together" run opens with a connection bonus (stand-in for running with a friend).
  function applyStartBonus() {
    const m = MOOD[mood] || MOOD.Explore;
    if (m.bonus) { S.current.pts += m.bonus; refreshHud(); flash('+' + m.bonus + ' · running together'); }
  }

  // scoring when the trail reaches a point
  function score(x, y) {
    const s = S.current;
    const gx = Math.round(x / GS) * GS, gy = Math.round(y / GS) * GS;
    if (Math.hypot(x - gx, y - gy) < 12) {
      const k = gx + ',' + gy;
      if (!s.visited.has(k) && gx > 40 && gx < W - 40 && gy > 40 && gy < H - 40) {
        s.visited.add(k); s.streets++; s.pts += Math.round(20 * (MOOD[mood] || MOOD.Explore).street); refreshHud();
      }
    }
    LM.forEach((l, i) => {
      if (!s.found.has(i) && Math.hypot(x - l.x, y - l.y) < 26) {
        s.found.add(i); s.pts += Math.round(l.pts * (MOOD[mood] || MOOD.Explore).lm); refreshHud();
        flash('+' + l.pts + ' · ' + l.name);
        dot(S.current.ctx.map, l.x, l.y, 5, l.col); ring(S.current.ctx.map, l.x, l.y, 9, l.col);
      }
    });
  }

  let toastTimer = useRef(0);
  function flash(txt) {
    setToast(txt);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2000);
  }

  // record a point onto the current run (erode + trail + score)
  function stamp(x, y) {
    const s = S.current;
    if (s.prev) { erode(x, y); trailSeg(s.prev[0], s.prev[1], x, y); }
    else erode(x, y);
    score(x, y);
    s.cur.push([Math.round(x), Math.round(y)]);
    s.prev = [x, y];
  }

  // ---------- persistence ----------
  function save() {
    const s = S.current;
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        runs: s.runs, streets: s.streets, pts: s.pts,
        visited: [...s.visited], found: [...s.found],
      }));
    } catch (e) { /* storage full / private mode — ignore for v1 */ }
  }

  function load() {
    const s = S.current;
    let data;
    try { data = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch { data = null; }
    if (!data) return;
    s.runs = data.runs || [];
    s.streets = data.streets || 0;
    s.pts = data.pts || 0;
    s.visited = new Set(data.visited || []);
    s.found = new Set(data.found || []);
    // replay every past run onto the canvases
    s.runs.forEach(run => {
      for (let i = 0; i < run.length; i++) {
        const [x, y] = run[i];
        erode(x, y);
        if (i > 0) trailSeg(run[i-1][0], run[i-1][1], x, y);
      }
    });
    s.found.forEach(i => { const l = LM[i]; dot(S.current.ctx.map, l.x, l.y, 5, l.col); ring(S.current.ctx.map, l.x, l.y, 9, l.col); });
    refreshHud();
  }

  function commitRun() {
    const s = S.current;
    if (s.cur.length > 1) { s.runs.push(s.cur); save(); }
    s.cur = []; s.prev = null;
  }

  // ---------- demo run ----------
  function playDemo() {
    const s = S.current;
    if (s.playing) return;
    stopAll();
    s.route = RUNS[s.runIdx % RUNS.length];
    s.runIdx++;
    s.seg = 0; s.segT = 0; s.prev = s.route[0].slice(); s.cur = [s.route[0].slice()];
    s.playing = true; setStatus('demo');
    applyStartBonus();
    let t = 0;
    const loop = () => {
      if (!s.playing) return;
      t += 0.09;
      let remaining = 3.0;
      while (remaining > 0) {
        const a = s.route[s.seg], b = s.route[s.seg + 1];
        if (!b) { drawRunner(s.prev[0], s.prev[1], true, t); s.playing = false; setStatus('idle'); commitRun(); return; }
        const dx = b[0]-a[0], dy = b[1]-a[1], len = Math.hypot(dx, dy);
        s.segT += remaining / len;
        if (s.segT >= 1) { remaining = (s.segT - 1) * len; s.segT = 0; s.seg++; stamp(b[0], b[1]); }
        else { const x = a[0]+dx*s.segT, y = a[1]+dy*s.segT; stamp(x, y); remaining = 0; }
      }
      drawRunner(s.prev[0], s.prev[1], false, t);
      s.raf = requestAnimationFrame(loop);
    };
    s.raf = requestAnimationFrame(loop);
  }

  // ---------- real GPS run (beta) ----------
  function startGPS() {
    const s = S.current;
    if (!('geolocation' in navigator)) { flash('No GPS on this device'); return; }
    stopAll();
    s.origin = null; s.prev = null; s.cur = [];
    setStatus('gps');
    applyStartBonus();
    s.geoId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        if (!s.origin) s.origin = { lat: latitude, lng: longitude };
        const mLat = 111320, mLng = 111320 * Math.cos(s.origin.lat * Math.PI / 180);
        const px = 3; // pixels per meter
        const x = W/2 + (longitude - s.origin.lng) * mLng * px;
        const y = H/2 - (latitude - s.origin.lat) * mLat * px;
        if (x < 0 || x > W || y < 0 || y > H) return; // off the demo canvas (Mapbox will fix this)
        stamp(x, y);
        drawRunner(x, y, false, performance.now() / 200);
      },
      () => flash('GPS permission denied'),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 8000 }
    );
  }

  function stopGPS() {
    const s = S.current;
    if (s.geoId != null) { navigator.geolocation.clearWatch(s.geoId); s.geoId = null; }
    S.current.ctx.fx.clearRect(0, 0, W, H);
    commitRun(); setStatus('idle');
  }

  function stopAll() {
    const s = S.current;
    s.playing = false;
    if (s.raf) cancelAnimationFrame(s.raf);
    if (s.geoId != null) { navigator.geolocation.clearWatch(s.geoId); s.geoId = null; }
  }

  function resetMap() {
    stopAll();
    const s = S.current;
    s.runs = []; s.visited = new Set(); s.found = new Set(); s.streets = 0; s.pts = 0;
    s.cur = []; s.prev = null; s.runIdx = 0;
    localStorage.removeItem(STORE_KEY);
    S.current.ctx.trail.clearRect(0, 0, W, H);
    S.current.ctx.fx.clearRect(0, 0, W, H);
    drawMap(); fillFog(); refreshHud(); setStatus('idle');
  }

  // ---------- mount ----------
  useEffect(() => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const setup = (ref) => {
      const cv = ref.current; cv.width = W * dpr; cv.height = H * dpr;
      const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr); return ctx;
    };
    S.current.ctx = {
      map: setup(mapRef), trail: setup(trailRef), fog: setup(fogRef), fx: setup(fxRef),
    };
    drawMap(); fillFog(); load();
    return () => { stopAll(); clearTimeout(toastTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const running = status !== 'idle';

  return (
    <div className="fogmap">
      <div className="stage">
        <canvas ref={mapRef} /><canvas ref={trailRef} /><canvas ref={fogRef} /><canvas ref={fxRef} />
        <div className="coord"><span className="pin">◉</span> DURHAM, NH · zoom 15</div>
        {status === 'idle' && (
          <button className="mood-chip" style={{ '--mc': (MOOD[mood] || MOOD.Explore).tint }} onClick={onEditMood}>
            <span className="mdot" /> {mood} · {(MOOD[mood] || MOOD.Explore).blurb} ✎
          </button>
        )}
        {status === 'gps' && <div className="rec-badge"><span className="d" /> RECORDING</div>}
        <div className="hud">
          <div className="stat"><div className="n">{hud.streets}</div><div className="l">streets</div></div>
          <div className="stat"><div className="n">{hud.pct}%</div><div className="l">explored</div></div>
          <div className="stat pts"><div className="n">{hud.pts}</div><div className="l">points</div></div>
        </div>
        {toast && <div className="toast">{toast}</div>}
      </div>

      <div className="controls">
        {status !== 'gps' ? (
          <button className="primary" onClick={playDemo} disabled={status === 'demo'}>
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
            {status === 'demo' ? 'Revealing…' : 'Demo run'}
          </button>
        ) : (
          <button className="stop" onClick={stopGPS}>
            <svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
            Finish run
          </button>
        )}
        <button onClick={startGPS} disabled={running}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12z" /><circle cx="12" cy="9" r="2.5" /></svg>
          Use my GPS
        </button>
        <button className="ghost" onClick={resetMap} disabled={running}>Reset</button>
      </div>

      <p className="hint">
        <b>Demo run</b> reveals a route so you can see the mechanic — tap it a few times to spread your territory.
        <b> Use my GPS</b> plots your real movement (beta; a real Mapbox map + camera lands next). Your territory saves on this device.
      </p>
    </div>
  );
}
