import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// Same worker fix as FogMap — without this the GeoJSON line layers silently fail.
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
maplibregl.setWorkerUrl(maplibreWorkerUrl);
import './CommunityMap.css';
import { supabase } from './lib/supabase.js';

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

const DEFAULT_CENTER = [-70.9265, 43.1339]; // Durham, NH

const lineFC = (routes) => ({
  type: 'FeatureCollection',
  features: routes.filter(r => Array.isArray(r) && r.length > 1)
    .map(r => ({ type: 'Feature', geometry: { type: 'LineString', coordinates: r } })),
});

function haversineKm(a, b) {
  const R = 6371, toR = Math.PI / 180;
  const dLat = (b[1] - a[1]) * toR, dLng = (b[0] - a[0]) * toR;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * toR) * Math.cos(b[1] * toR) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export default function CommunityMap() {
  const mapEl = useRef(null);
  const M = useRef({ map: null, bounds: null });
  const [state, setState] = useState('loading'); // loading | ready | empty | error
  const [stats, setStats] = useState({ runs: 0, km: 0 });

  useEffect(() => {
    const map = new maplibregl.Map({
      container: mapEl.current,
      style: MAP_STYLE,
      center: DEFAULT_CENTER, zoom: 11, attributionControl: true,
    });
    M.current.map = map;

    map.on('load', async () => {
      map.addSource('trails', { type: 'geojson', data: lineFC([]) });
      // Low-opacity glow so overlapping runs build up brightness where lots of
      // people have run — a natural "heat" without a heatmap layer.
      map.addLayer({ id: 'com-glow', type: 'line', source: 'trails', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#e8a33d', 'line-width': 7, 'line-blur': 8, 'line-opacity': 0.32 } });
      map.addLayer({ id: 'com-core', type: 'line', source: 'trails', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#f8d489', 'line-width': 1.8, 'line-opacity': 0.9 } });
      map.resize();
      await loadTrails();
    });

    const onResize = () => map.resize();
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); map.remove(); M.current.map = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadTrails() {
    const map = M.current.map;
    if (!map) return;
    if (!supabase) { setState('error'); return; }
    setState('loading');
    const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 15000));
    let data, error;
    try {
      ({ data, error } = await Promise.race([supabase.rpc('community_trails', { max_runs: 4000 }), timeout]));
    } catch (e) { error = e; }
    if (error) { console.warn('community_trails failed:', error.message); setState('error'); return; }

    const routes = (data || []).map(r => r.route).filter(r => Array.isArray(r) && r.length > 1);
    map.getSource('trails')?.setData(lineFC(routes));

    if (!routes.length) { setState('empty'); return; }

    // fit to all runs + tally distance
    let minLng = 180, minLat = 90, maxLng = -180, maxLat = -90, km = 0;
    for (const r of routes) {
      for (let i = 0; i < r.length; i++) {
        const [lng, lat] = r[i];
        if (lng < minLng) minLng = lng; if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat;
        if (i > 0) km += haversineKm(r[i - 1], r[i]);
      }
    }
    M.current.bounds = [[minLng, minLat], [maxLng, maxLat]];
    fitToRuns(true);
    setStats({ runs: routes.length, km });
    setState('ready');
  }

  function fitToRuns(instant) {
    const map = M.current.map, b = M.current.bounds;
    if (!map || !b) return;
    map.fitBounds(b, { padding: 48, maxZoom: 14, duration: instant ? 0 : 900 });
  }
  function viewWorld() {
    M.current.map?.easeTo({ center: [-30, 25], zoom: 1.4, duration: 1200 });
  }

  const miles = (stats.km * 0.621371);

  return (
    <div className="commap">
      <div className="com-wrap">
        <div ref={mapEl} className="mapbox" />

        <div className="com-title">
          <span className="ct-dot" /> Community map
          <span className="ct-sub">everywhere Roam has run</span>
        </div>

        <div className="com-controls">
          <button onClick={() => fitToRuns(false)} title="Frame all runs">◎ Runs</button>
          <button onClick={viewWorld} title="Zoom out to the world">🌍 World</button>
        </div>

        {state === 'ready' && (
          <div className="com-stats">
            <div className="cs"><div className="n">{stats.runs.toLocaleString()}</div><div className="l">runs mapped</div></div>
            <div className="cs"><div className="n">{miles < 10 ? miles.toFixed(1) : Math.round(miles).toLocaleString()}</div><div className="l">miles traced</div></div>
          </div>
        )}

        {state === 'loading' && <div className="com-note">Loading the community map…</div>}
        {state === 'empty' && <div className="com-note">No runs on the map yet — go for a run and watch it fill in. 🏃</div>}
        {state === 'error' && <div className="com-note">Couldn’t load the community map. If this just launched, the <code>community_trails</code> DB function may still need to be added.</div>}
      </div>

      <p className="com-foot">
        Every glowing line is a real Roam run — start points are trimmed for privacy, so this shows <b>where we roam</b>, never where anyone lives. As more people run, the map fills in.
      </p>
    </div>
  );
}
