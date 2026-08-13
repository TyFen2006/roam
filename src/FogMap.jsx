import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// Force the bundler to emit MapLibre's worker file and point MapLibre at it —
// otherwise the worker 404s (served index.html), and every GeoJSON/vector layer
// silently fails to render while raster tiles still work.
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
maplibregl.setWorkerUrl(maplibreWorkerUrl);
import './FogMap.css';
import { supabase } from './lib/supabase.js';

// Free, no-token dark basemap — CARTO "dark_all" RASTER tiles: rock-solid, no key,
// no glyph/sprite deps (the vector style was silently failing → black map).
const MAP_STYLE = {
  version: 8,
  sources: {
    basemap: {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
        'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
        'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
        'https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
      ],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors © CARTO',
    },
  },
  layers: [
    { id: 'bg', type: 'background', paint: { 'background-color': '#0a0e13' } },
    { id: 'basemap', type: 'raster', source: 'basemap' },
  ],
};

const MOOD = {
  Together: { street: 1,   tint: '#e8a33d', blurb: 'connection ×2',  bonus: 50 },
  Explore:  { street: 1.6, tint: '#7fb0b6', blurb: 'new ground',     bonus: 0 },
  Scenic:   { street: 1,   tint: '#3f8f6d', blurb: 'views',          bonus: 0 },
  Chill:    { street: 1,   tint: '#33a08f', blurb: 'effort not pace', bonus: 0 },
};

const STORE_KEY = 'roam.geo.v1';
const DEFAULT_CENTER = [-70.9265, 43.1339]; // Durham, NH — until we get a real fix

// ---- geo helpers ----
const lineFC = (routes) => ({
  type: 'FeatureCollection',
  features: routes.filter(r => r.length > 1).map(r => ({ type: 'Feature', geometry: { type: 'LineString', coordinates: r } })),
});
const ptFC = (c) => ({ type: 'FeatureCollection', features: c ? [{ type: 'Feature', geometry: { type: 'Point', coordinates: c } }] : [] });
const cellKey = (lng, lat) => Math.round(lng / 0.0007) + ',' + Math.round(lat / 0.0007);
function haversineKm(a, b) {
  const R = 6371, toR = Math.PI / 180;
  const dLat = (b[1] - a[1]) * toR, dLng = (b[0] - a[0]) * toR;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * toR) * Math.cos(b[1] * toR) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
function softStops(c, x, y, r, stops) {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  for (const [o, a] of stops) g.addColorStop(o, `rgba(0,0,0,${a})`);
  c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
}

export default function FogMap({ mood = 'Explore', onEditMood, userId }) {
  const mapEl = useRef(null), fogEl = useRef(null);
  const M = useRef({ map: null, fog: null, watch: null, wake: null, demo: null, routes: [], cur: [], cells: new Set(), dist: 0, pts: 0, following: true });
  const [status, setStatus] = useState('idle');       // idle | gps | demo
  const [hud, setHud] = useState({ dist: 0, pts: 0, cells: 0 });
  const [toast, setToast] = useState(null);
  const [showRecenter, setShowRecenter] = useState(false);
  const [unit, setUnit] = useState(() => { try { return localStorage.getItem('roam.unit') || 'mi'; } catch { return 'mi'; } });
  const toastTimer = useRef(0);
  const toggleUnit = () => setUnit(u => { const n = u === 'mi' ? 'km' : 'mi'; try { localStorage.setItem('roam.unit', n); } catch {} return n; });

  const flash = (t) => { setToast(t); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(null), 2200); };
  const refreshHud = () => setHud({ dist: +M.current.dist.toFixed(2), pts: M.current.pts, cells: M.current.cells.size });

  // ---- fog overlay ----
  function fogCtx() {
    const el = fogEl.current, wrap = mapEl.current;
    if (!el || !wrap || !wrap.clientWidth) return null;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = Math.round(wrap.clientWidth * dpr), H = Math.round(wrap.clientHeight * dpr);
    if (el.width !== W || el.height !== H) {
      el.width = W; el.height = H; el.style.width = wrap.clientWidth + 'px'; el.style.height = wrap.clientHeight + 'px';
    }
    return { ctx: el.getContext('2d'), w: wrap.clientWidth, h: wrap.clientHeight, dpr };
  }
  function drawFog() {
    const map = M.current.map;
    if (!map) return;
    const fog = fogCtx();
    if (!fog) return;
    const c = fog.ctx, { w, h, dpr } = fog;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.globalCompositeOperation = 'source-over';
    c.clearRect(0, 0, w, h);
    c.fillStyle = 'rgba(9,13,20,0.5)';
    c.fillRect(0, 0, w, h);
    c.globalCompositeOperation = 'destination-out';
    c.filter = 'blur(4px)';
    const stamp = (pts) => {
      for (let i = 0; i < pts.length; i++) {
        const p = map.project(pts[i]);
        if (p.x < -150 || p.x > w + 150 || p.y < -150 || p.y > h + 150) continue;
        softStops(c, p.x, p.y, 92, [[0, 0.85], [0.25, 0.55], [0.5, 0.3], [0.75, 0.12], [1, 0]]);
      }
    };
    for (const r of M.current.routes) stamp(r);
    stamp(M.current.cur);
    c.filter = 'none';
    c.globalCompositeOperation = 'source-over';
  }

  // ---- scoring / run pipeline ----
  function applyStartBonus() {
    const b = (MOOD[mood] || MOOD.Explore).bonus;
    if (b) { M.current.pts += b; refreshHud(); flash('+' + b + ' · running together'); }
  }
  function handlePosition(lng, lat, heading, speed) {
    const s = M.current;
    const prev = s.cur[s.cur.length - 1];
    s.cur.push([lng, lat]);
    if (prev) s.dist += haversineKm(prev, [lng, lat]);
    const k = cellKey(lng, lat);
    if (!s.cells.has(k)) { s.cells.add(k); s.pts += Math.round(15 * (MOOD[mood] || MOOD.Explore).street); }
    s.map.getSource('trail')?.setData(lineFC([...s.routes, s.cur]));
    s.map.getSource('me')?.setData(ptFC([lng, lat]));
    if (s.following) {
      const opts = { center: [lng, lat], duration: 800, essential: true };
      if (heading != null && !Number.isNaN(heading) && speed > 0.6) opts.bearing = heading;
      s.map.easeTo(opts);
    }
    refreshHud();
  }

  // ---- real GPS ----
  function startGPS() {
    const s = M.current;
    if (!('geolocation' in navigator)) { flash('No GPS on this device'); return; }
    stopRun();
    s.cur = []; s.following = true; setShowRecenter(false);
    setStatus('gps'); requestWake();
    s.runStart = { pts: s.pts, dist: s.dist, cells: s.cells.size };
    applyStartBonus();
    s.watch = navigator.geolocation.watchPosition(
      (pos) => { const { longitude, latitude, heading, speed } = pos.coords; handlePosition(longitude, latitude, heading, speed); },
      (err) => flash(err.code === 1 ? 'Location permission denied' : 'Waiting for GPS…'),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 }
    );
  }

  // ---- demo (simulated walk from wherever the map is centered) ----
  function playDemo() {
    const s = M.current;
    if (status !== 'idle') return;
    stopRun();
    const c = s.map.getCenter(); let lng = c.lng, lat = c.lat, brg = Math.random() * 360;
    s.cur = []; s.following = true; setShowRecenter(false);
    setStatus('demo');
    s.runStart = { pts: s.pts, dist: s.dist, cells: s.cells.size };
    applyStartBonus();
    let n = 0;
    s.demo = setInterval(() => {
      n++; brg += (Math.random() - 0.5) * 45;
      const d = 0.00018, rad = brg * Math.PI / 180;
      lat += d * Math.cos(rad); lng += d * Math.sin(rad) / Math.cos(lat * Math.PI / 180);
      handlePosition(lng, lat, brg, 2);
      if (n > 55) finishRun();
    }, 260);
  }

  function stopRun() {
    const s = M.current;
    if (s.watch != null) { navigator.geolocation.clearWatch(s.watch); s.watch = null; }
    if (s.demo) { clearInterval(s.demo); s.demo = null; }
    releaseWake();
  }
  function finishRun() {
    const s = M.current;
    stopRun();
    if (s.cur.length > 1) {
      const run = s.cur;
      s.routes.push(run);
      // this run's own contribution (delta since it started)
      const rPts = Math.max(0, s.pts - (s.runStart?.pts ?? s.pts));
      const rDist = Math.max(0, s.dist - (s.runStart?.dist ?? s.dist));
      const rCells = Math.max(0, s.cells.size - (s.runStart?.cells ?? s.cells.size));
      save(); // local mirror (offline safety)
      if (userId && supabase) {
        supabase.from('runs').insert({
          user_id: userId, route: run, mood,
          distance_km: +rDist.toFixed(3), points: rPts, cells: rCells,
        }).then(({ error }) => { if (error) flash('Saved offline (sync later)'); });
      }
    }
    s.cur = []; s.runStart = null;
    s.map?.getSource('me')?.setData(ptFC(null));
    setStatus('idle');
  }
  function resetTerritory() {
    const s = M.current;
    stopRun();
    s.routes = []; s.cur = []; s.cells = new Set(); s.pts = 0; s.dist = 0;
    localStorage.removeItem(STORE_KEY);
    if (userId && supabase) supabase.from('runs').delete().eq('user_id', userId).then(() => {});
    s.map?.getSource('trail')?.setData(lineFC([]));
    s.map?.getSource('me')?.setData(ptFC(null));
    refreshHud(); drawFog(); setStatus('idle');
  }
  function recenter() {
    const s = M.current; s.following = true; setShowRecenter(false);
    const last = s.cur[s.cur.length - 1];
    if (last) s.map.easeTo({ center: last, zoom: 16, duration: 700 });
    else locateOnce();
  }

  // ---- wake lock (keep screen on while running) ----
  async function requestWake() { try { M.current.wake = await navigator.wakeLock?.request('screen'); } catch { /* unsupported */ } }
  function releaseWake() { try { M.current.wake?.release?.(); } catch {} M.current.wake = null; }

  // ---- persistence ----
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ routes: M.current.routes, pts: M.current.pts, cells: [...M.current.cells], dist: M.current.dist })); } catch {}
  }
  async function loadSaved() {
    const s = M.current;
    let routes = null, pts = 0, dist = 0;
    // Source of truth = your Supabase runs (syncs across devices). Fall back to
    // local mirror if logged out or offline.
    if (userId && supabase) {
      const { data, error } = await supabase.from('runs').select('route,distance_km,points').eq('user_id', userId);
      if (!error && Array.isArray(data)) {
        routes = data.map(r => r.route).filter(r => Array.isArray(r) && r.length > 1);
        pts = data.reduce((a, r) => a + (r.points || 0), 0);
        dist = data.reduce((a, r) => a + Number(r.distance_km || 0), 0);
      }
    }
    if (routes === null) {
      let d; try { d = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch { d = null; }
      if (d) { routes = d.routes || []; pts = d.pts || 0; dist = d.dist || 0; }
    }
    if (!routes) return;
    s.routes = routes; s.pts = pts; s.dist = dist;
    s.cells = new Set();
    for (const r of routes) for (const p of r) s.cells.add(cellKey(p[0], p[1]));
    s.map?.getSource('trail')?.setData(lineFC(routes));
    refreshHud();
    drawFog();
  }
  function locateOnce() {
    if (!('geolocation' in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { longitude, latitude } = pos.coords;
        M.current.map.easeTo({ center: [longitude, latitude], zoom: 16, duration: 800 });
        M.current.map.getSource('me')?.setData(ptFC([longitude, latitude]));
      },
      () => flash('Turn on location to center on you'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  // ---- mount map ----
  useEffect(() => {
    const map = new maplibregl.Map({
      container: mapEl.current,
      style: MAP_STYLE,
      center: DEFAULT_CENTER, zoom: 14.5, attributionControl: true,
    });
    M.current.map = map;
    map.on('load', () => {
      map.addSource('trail', { type: 'geojson', data: lineFC([]) });
      map.addLayer({ id: 'trail-glow', type: 'line', source: 'trail', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#e8a33d', 'line-width': 11, 'line-blur': 9, 'line-opacity': 0.55 } });
      map.addLayer({ id: 'trail-core', type: 'line', source: 'trail', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#f8d489', 'line-width': 4 } });
      map.addSource('me', { type: 'geojson', data: ptFC(null) });
      map.addLayer({ id: 'me-halo', type: 'circle', source: 'me', paint: { 'circle-radius': 15, 'circle-color': '#e8a33d', 'circle-opacity': 0.18 } });
      map.addLayer({ id: 'me-dot', type: 'circle', source: 'me', paint: { 'circle-radius': 7, 'circle-color': '#f4c877', 'circle-stroke-color': '#12100a', 'circle-stroke-width': 2 } });
      loadSaved(); map.resize(); drawFog();
      locateOnce();
    });
    map.on('render', drawFog);
    map.on('resize', drawFog);
    map.on('dragstart', () => { M.current.following = false; setShowRecenter(true); });
    const onResize = () => { map.resize(); };
    window.addEventListener('resize', onResize);
    return () => { stopRun(); window.removeEventListener('resize', onResize); clearTimeout(toastTimer.current); map.remove(); M.current.map = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const m = MOOD[mood] || MOOD.Explore;

  return (
    <div className="fogmap-live">
      <div className="map-wrap">
        <div ref={mapEl} className="mapbox" />
        <canvas ref={fogEl} className="fog-ov" />
        <div className="coord"><span className="pin">◉</span> {status === 'gps' ? 'LIVE · following you' : 'your map'}</div>
        {status === 'idle' && (
          <button className="mood-chip" style={{ '--mc': m.tint }} onClick={onEditMood}>
            <span className="mdot" /> {mood} · {m.blurb} ✎
          </button>
        )}
        {status === 'gps' && <div className="rec-badge"><span className="d" /> RECORDING</div>}
        {showRecenter && <button className="recenter" onClick={recenter}>◎ Recenter</button>}
        <div className="hud">
          <button className="stat unit" onClick={toggleUnit}>
            <div className="n">{(unit === 'mi' ? hud.dist * 0.621371 : hud.dist).toFixed(2)}</div>
            <div className="l">{unit} ⇄</div>
          </button>
          <div className="stat"><div className="n">{hud.cells}</div><div className="l">explored</div></div>
          <div className="stat pts"><div className="n">{hud.pts}</div><div className="l">points</div></div>
        </div>
        {toast && <div className="toast">{toast}</div>}
      </div>

      <div className="controls">
        {status !== 'gps' ? (
          <button className="primary" onClick={startGPS} disabled={status === 'demo'}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12z" /><circle cx="12" cy="9" r="2.5" /></svg>
            {status === 'demo' ? 'Demo running…' : 'Start GPS run'}
          </button>
        ) : (
          <button className="stop" onClick={finishRun}>
            <svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
            Finish run
          </button>
        )}
        <button onClick={playDemo} disabled={status !== 'idle'}>
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
          Demo
        </button>
        <button className="ghost" onClick={resetTerritory} disabled={status !== 'idle'}>Reset</button>
      </div>

      <p className="hint">
        <b>Start GPS run</b> uses your real location — allow location, and your streets clear as you move (works outdoors, anywhere).
        <b> Demo</b> simulates a walk from where the map is centered so you can see it indoors. Territory saves on this device.
      </p>
    </div>
  );
}
