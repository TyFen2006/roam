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
import { initials } from './lib/util.js';

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
const CELL = 0.0007;
const cellKey = (lng, lat) => Math.round(lng / CELL) + ',' + Math.round(lat / CELL);
function cellPolygon(cell, mine) {
  const [cx, cy] = cell.split(',').map(Number);
  const a = (cx - 0.5) * CELL, b = (cx + 0.5) * CELL, c = (cy - 0.5) * CELL, d = (cy + 0.5) * CELL;
  return { type: 'Feature', properties: { mine }, geometry: { type: 'Polygon', coordinates: [[[a, c], [b, c], [b, d], [a, d], [a, c]]] } };
}
function haversineKm(a, b) {
  const R = 6371, toR = Math.PI / 180;
  const dLat = (b[1] - a[1]) * toR, dLng = (b[0] - a[0]) * toR;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * toR) * Math.cos(b[1] * toR) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
function routeLengthM(coords) { let d = 0; for (let i = 1; i < coords.length; i++) d += haversineKm(coords[i - 1], coords[i]) * 1000; return d; }
// Ask OSRM's free public server for a real street-following route from (lng,lat)
// to a random nearby point, so the demo runs on actual roads. Returns [[lng,lat]…] or null.
async function streetRoute(lng, lat) {
  const brg = Math.random() * Math.PI * 2, dKm = 0.5 + Math.random() * 0.5;
  const eLat = lat + (dKm / 111) * Math.cos(brg);
  const eLng = lng + (dKm / (111 * Math.cos(lat * Math.PI / 180))) * Math.sin(brg);
  try {
    const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${lng},${lat};${eLng},${eLat}?overview=full&geometries=geojson`);
    const j = await r.json();
    const c = j?.routes?.[0]?.geometry?.coordinates;
    if (Array.isArray(c) && c.length > 1) return c;
  } catch { /* offline / blocked → caller falls back to a smooth wander */ }
  return null;
}
// Monday-of-this-week as YYYY-MM-DD (matches the Quests tab).
function weekMonday() {
  const d = new Date(); const off = (d.getDay() + 6) % 7;
  d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - off);
  return d.toISOString().slice(0, 10);
}
// Snap a point to the nearest road (so the weekly spot is reachable).
async function nearestRoad(lng, lat) {
  try {
    const r = await fetch(`https://router.project-osrm.org/nearest/v1/driving/${lng},${lat}?number=1`);
    const j = await r.json();
    const wp = j?.waypoints?.[0];
    if (wp?.location) return { lng: wp.location[0], lat: wp.location[1], name: wp.name || '' };
  } catch { /* fall through */ }
  return { lng, lat, name: '' };
}
async function genSpot(nearLng, nearLat) {
  const brg = Math.random() * Math.PI * 2, dKm = 0.8 + Math.random() * 0.5;
  const lat = nearLat + (dKm / 111) * Math.cos(brg);
  const lng = nearLng + (dKm / (111 * Math.cos(nearLat * Math.PI / 180))) * Math.sin(brg);
  return nearestRoad(lng, lat);
}
function softStops(c, x, y, r, stops) {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  for (const [o, a] of stops) g.addColorStop(o, `rgba(0,0,0,${a})`);
  c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
}
// stable color per user id (for live-run markers)
function colorFor(id) {
  let h = 0; const str = String(id || '');
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 360;
  return `hsl(${h} 72% 58%)`;
}

export default function FogMap({ mood = 'Explore', onEditMood, userId, myName }) {
  const mapEl = useRef(null), fogEl = useRef(null);
  const M = useRef({ map: null, fog: null, watch: null, wake: null, demo: null, routes: [], cur: [], cells: new Set(), dist: 0, pts: 0, following: true });
  const [status, setStatus] = useState('idle');       // idle | gps | demo
  const [hud, setHud] = useState({ dist: 0, pts: 0, cells: 0 });
  const [toast, setToast] = useState(null);
  const [showRecenter, setShowRecenter] = useState(false);
  const [unit, setUnit] = useState(() => { try { return localStorage.getItem('roam.unit') || 'mi'; } catch { return 'mi'; } });
  const toastTimer = useRef(0);
  const toggleUnit = () => setUnit(u => { const n = u === 'mi' ? 'km' : 'mi'; try { localStorage.setItem('roam.unit', n); } catch {} return n; });
  const [liveCode, setLiveCode] = useState(null);
  const [liveOpen, setLiveOpen] = useState(false);
  const [joinInput, setJoinInput] = useState('');
  const [roster, setRoster] = useState([]);
  const [spot, setSpot] = useState(null);
  const [terrOn, setTerrOn] = useState(false);
  const [ownedCount, setOwnedCount] = useState(0);

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
    s.lastPos = [lng, lat];
    if (s.live && supabase) {
      const now = Date.now();
      if (!s.liveTrackAt || now - s.liveTrackAt > 700) { s.liveTrackAt = now; trackPresence(); }
    }
    if (s.spot && !s.spot.reached && haversineKm([lng, lat], [s.spot.lng, s.spot.lat]) < 0.09) markSpotReached();
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
  async function playDemo() {
    const s = M.current;
    if (status !== 'idle') return;
    stopRun();
    setStatus('demo');
    s.cur = []; s.following = true; setShowRecenter(false);
    s.runStart = { pts: s.pts, dist: s.dist, cells: s.cells.size };
    applyStartBonus();
    const c = s.map.getCenter();
    const route = await streetRoute(c.lng, c.lat);   // real streets when available
    s.demoStop = false;
    let last = performance.now();

    if (route) {
      const segLens = [];
      for (let i = 1; i < route.length; i++) segLens.push(Math.max(0.01, haversineKm(route[i - 1], route[i]) * 1000));
      const total = segLens.reduce((a, b) => a + b, 0);
      const speed = Math.max(6, total / 22);          // finish in ~22s
      const commitEvery = Math.max(3, total / 260);   // ~a point every few metres → smooth line
      const coordAt = (dist) => {
        let d = dist;
        for (let i = 0; i < segLens.length; i++) {
          if (d <= segLens[i]) { const f = d / segLens[i], a = route[i], b = route[i + 1]; return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]; }
          d -= segLens[i];
        }
        return route[route.length - 1];
      };
      let traveled = 0, lastCommit = -commitEvery;
      const frame = (now) => {
        if (s.demoStop) return;
        const dt = Math.min(0.05, (now - last) / 1000); last = now;
        traveled += speed * dt;
        const p = coordAt(Math.min(traveled, total));
        if (traveled - lastCommit >= commitEvery) { lastCommit = traveled; handlePosition(p[0], p[1], null, speed); }
        if (traveled >= total) { handlePosition(p[0], p[1], null, speed); finishRun(); return; }
        s.demoRaf = requestAnimationFrame(frame);
      };
      s.demoRaf = requestAnimationFrame(frame);
    } else {
      // fallback: a smooth gentle wander (only if routing is unavailable)
      let lng = c.lng, lat = c.lat, brg = Math.random() * 360, traveled = 0, lastCommit = 0;
      const frame = (now) => {
        if (s.demoStop) return;
        const dt = Math.min(0.05, (now - last) / 1000); last = now;
        const move = 12 * dt;
        brg += (Math.random() - 0.5) * 6;
        lat += (move / 111000) * Math.cos(brg * Math.PI / 180);
        lng += (move / (111000 * Math.cos(lat * Math.PI / 180))) * Math.sin(brg * Math.PI / 180);
        traveled += move;
        if (traveled - lastCommit >= 5) { lastCommit = traveled; handlePosition(lng, lat, null, 12); }
        if (traveled >= 600) { finishRun(); return; }
        s.demoRaf = requestAnimationFrame(frame);
      };
      s.demoRaf = requestAnimationFrame(frame);
    }
  }

  function stopRun() {
    const s = M.current;
    if (s.watch != null) { navigator.geolocation.clearWatch(s.watch); s.watch = null; }
    if (s.demo) { clearInterval(s.demo); s.demo = null; }
    s.demoStop = true;
    if (s.demoRaf) { cancelAnimationFrame(s.demoRaf); s.demoRaf = 0; }
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
        // claim the streets this run covered (territory game)
        const cset = new Set(); for (const p of run) cset.add(cellKey(p[0], p[1]));
        supabase.rpc('claim_cells', { cells: [...cset] }).then(() => { if (M.current.terrOn) refreshTerritory(); });
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
  // ---- territory (own streets; friends can take them) ----
  async function refreshTerritory() {
    const map = M.current.map;
    if (!map || !supabase || !userId) return;
    const { data, error } = await supabase.rpc('my_territory');
    if (error) return;
    map.getSource('territory')?.setData({ type: 'FeatureCollection', features: (data || []).map(r => cellPolygon(r.cell, r.mine)) });
    setOwnedCount((data || []).filter(r => r.mine).length);
  }
  async function toggleTerritory() {
    const map = M.current.map; if (!map) return;
    if (terrOn) { setTerrOn(false); M.current.terrOn = false; map.getSource('territory')?.setData({ type: 'FeatureCollection', features: [] }); return; }
    if (!supabase || !userId) { flash('Log in to claim territory'); return; }
    setTerrOn(true); M.current.terrOn = true;
    await refreshTerritory();
  }

  // ---- weekly "run to a spot" quest ----
  function renderSpot(s) {
    M.current.spot = s; setSpot(s);
    const map = M.current.map; if (!map || !s) return;
    let mk = M.current.spotMarker;
    if (!mk) {
      const el = document.createElement('div');
      el.className = 'spot-marker';
      mk = new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([s.lng, s.lat]).addTo(map);
      M.current.spotMarker = mk;
    }
    mk.setLngLat([s.lng, s.lat]);
    const el = mk.getElement();
    el.className = 'spot-marker' + (s.reached ? ' reached' : '');
    el.textContent = s.reached ? '✓' : '📍';
  }
  async function ensureSpot(nearLng, nearLat) {
    if (!userId || !supabase || M.current.spot) return;
    const week = weekMonday();
    const { data } = await supabase.from('quest_spots').select('lng,lat,reached,name').eq('user_id', userId).eq('week', week).maybeSingle();
    if (data) { renderSpot({ ...data, week }); return; }
    const g = await genSpot(nearLng, nearLat);
    const ins = await supabase.from('quest_spots').insert({ user_id: userId, week, lng: g.lng, lat: g.lat, name: g.name || null }).select('lng,lat,reached,name').maybeSingle();
    if (ins.data) { renderSpot({ ...ins.data, week }); return; }
    const { data: d2 } = await supabase.from('quest_spots').select('lng,lat,reached,name').eq('user_id', userId).eq('week', week).maybeSingle();
    if (d2) renderSpot({ ...d2, week });
  }
  async function markSpotReached() {
    const s = M.current.spot; if (!s || s.reached) return;
    renderSpot({ ...s, reached: true });
    flash('🎯 Reached this week\'s spot! Claim it in Quests');
    try { await supabase.from('quest_spots').update({ reached: true }).eq('user_id', userId).eq('week', weekMonday()); } catch {}
  }

  function locateOnce() {
    if (!('geolocation' in navigator)) { if (M.current.map) { const c = M.current.map.getCenter(); ensureSpot(c.lng, c.lat); } return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { longitude, latitude } = pos.coords;
        M.current.map.easeTo({ center: [longitude, latitude], zoom: 16, duration: 800 });
        M.current.map.getSource('me')?.setData(ptFC([longitude, latitude]));
        M.current.lastPos = [longitude, latitude];
        if (M.current.live) trackPresence();
        ensureSpot(longitude, latitude);
      },
      () => { flash('Turn on location to center on you'); const c = M.current.map.getCenter(); ensureSpot(c.lng, c.lat); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  // ---- live "run together" (Supabase Realtime presence) ----
  function upsertRunner(id, name, color, lng, lat) {
    const live = M.current.live;
    if (!live || !M.current.map) return;
    let mk = live.markers.get(id);
    if (!mk) {
      const el = document.createElement('div');
      el.className = 'runner-marker';
      el.style.setProperty('--rc', color);
      el.textContent = initials(name);
      mk = new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(M.current.map);
      live.markers.set(id, mk);
    } else {
      mk.setLngLat([lng, lat]);
    }
  }
  function onPresenceSync() {
    const live = M.current.live;
    if (!live?.channel) return;
    const state = live.channel.presenceState();
    const present = new Set(), list = [];
    Object.values(state).forEach(arr => {
      const p = arr[arr.length - 1];
      if (!p || !p.id) return;
      list.push({ id: p.id, name: p.name });
      if (p.id !== userId && p.lng != null && p.lat != null) { upsertRunner(p.id, p.name, p.color, p.lng, p.lat); present.add(p.id); }
    });
    for (const [id, mk] of live.markers) { if (!present.has(id)) { mk.remove(); live.markers.delete(id); } }
    setRoster(list);
  }
  async function trackPresence() {
    const s = M.current;
    if (!s.live?.channel) return;
    const last = s.cur[s.cur.length - 1] || s.lastPos || null;
    try {
      await s.live.channel.track({ id: userId, name: myName || 'Runner', color: colorFor(userId), lng: last ? last[0] : null, lat: last ? last[1] : null });
    } catch { /* ignore */ }
  }
  function joinLive(code) {
    if (!supabase || !userId) { flash('Log in to run together'); return; }
    leaveLive();
    const s = M.current;
    const channel = supabase.channel(`roam-run-${code}`, { config: { presence: { key: userId } } });
    s.live = { channel, markers: new Map(), code };
    channel.on('presence', { event: 'sync' }, onPresenceSync);
    channel.subscribe(async (st) => {
      if (st === 'SUBSCRIBED') { await trackPresence(); setLiveCode(code); setLiveOpen(false); flash('Live run · code ' + code); }
    });
  }
  function startLive() { joinLive(Math.random().toString(36).slice(2, 6).toUpperCase()); }
  function leaveLive() {
    const s = M.current;
    if (s.live) {
      for (const [, mk] of s.live.markers) mk.remove();
      try { s.live.channel.unsubscribe(); supabase?.removeChannel(s.live.channel); } catch {}
      s.live = null;
    }
    setLiveCode(null); setRoster([]);
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
      // territory fills (under the trail): gold = yours, red = someone took it
      map.addSource('territory', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({ id: 'terr-fill', type: 'fill', source: 'territory', paint: { 'fill-color': ['case', ['get', 'mine'], '#e8a33d', '#e8654f'], 'fill-opacity': 0.22 } });
      map.addLayer({ id: 'terr-line', type: 'line', source: 'territory', paint: { 'line-color': ['case', ['get', 'mine'], '#f4c877', '#ff8a72'], 'line-width': 0.8, 'line-opacity': 0.45 } });
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
    return () => { stopRun(); leaveLive(); if (M.current.spotMarker) { M.current.spotMarker.remove(); M.current.spotMarker = null; } window.removeEventListener('resize', onResize); clearTimeout(toastTimer.current); map.remove(); M.current.map = null; };
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
        {!liveCode ? (
          <button className="live-btn" onClick={() => setLiveOpen(true)}>👥 Run live</button>
        ) : (
          <div className="live-bar">
            <span className="live-code">◉ {liveCode}</span>
            <div className="live-roster">
              {roster.map(r => <span key={r.id} className="lr-dot" title={r.name} style={{ '--rc': colorFor(r.id) }}>{initials(r.name)}</span>)}
            </div>
            <button className="live-leave" onClick={leaveLive}>Leave</button>
          </div>
        )}
        {liveOpen && (
          <div className="live-sheet">
            <div className="live-sheet-inner">
              <div className="ls-title">Run together</div>
              <p className="ls-sub">Share a code with a friend and watch each other move in real time.</p>
              <button className="ls-start" onClick={startLive}>Start a live run</button>
              <div className="ls-or">— or join —</div>
              <div className="ls-join">
                <input value={joinInput} onChange={e => setJoinInput(e.target.value.toUpperCase())} placeholder="CODE" maxLength={4} />
                <button onClick={() => joinInput.trim() && joinLive(joinInput.trim())}>Join</button>
              </div>
              <button className="ls-close" onClick={() => setLiveOpen(false)}>Cancel</button>
            </div>
          </div>
        )}
        <button className={`terr-btn ${terrOn ? 'on' : ''}`} onClick={toggleTerritory}>
          🏆 {terrOn ? `${ownedCount} street${ownedCount === 1 ? '' : 's'}` : 'Territory'}
        </button>
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
