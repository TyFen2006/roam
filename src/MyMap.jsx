import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// Same worker fix as FogMap/CommunityMap — otherwise the line layers silently fail.
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
maplibregl.setWorkerUrl(maplibreWorkerUrl);
import './MyMap.css';
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
const CELL = 0.0015;
const cellKey = (lng, lat) => Math.round(lng / CELL) + ',' + Math.round(lat / CELL);

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

export default function MyMap({ userId, onClose }) {
  const mapEl = useRef(null);
  const M = useRef({ map: null, bounds: null });
  const [state, setState] = useState('loading'); // loading | ready | empty | error
  const [stats, setStats] = useState({ runs: 0, km: 0, streets: 0 });

  useEffect(() => {
    const map = new maplibregl.Map({
      container: mapEl.current,
      style: MAP_STYLE,
      center: DEFAULT_CENTER, zoom: 12, attributionControl: true,
    });
    M.current.map = map;
    map.on('load', async () => {
      map.addSource('trails', { type: 'geojson', data: lineFC([]) });
      map.addLayer({ id: 'mm-glow', type: 'line', source: 'trails', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#e8a33d', 'line-width': 8, 'line-blur': 8, 'line-opacity': 0.4 } });
      map.addLayer({ id: 'mm-core', type: 'line', source: 'trails', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#f8d489', 'line-width': 2.4, 'line-opacity': 0.95 } });
      map.resize();
      await loadMine();
    });
    const onResize = () => map.resize();
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); map.remove(); M.current.map = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadMine() {
    const map = M.current.map;
    if (!map) return;
    if (!supabase || !userId) { setState('error'); return; }
    setState('loading');
    const { data, error } = await supabase.from('runs').select('route').eq('user_id', userId);
    if (error) { console.warn('MyMap load failed:', error.message); setState('error'); return; }

    const routes = (data || []).map(r => r.route).filter(r => Array.isArray(r) && r.length > 1);
    map.getSource('trails')?.setData(lineFC(routes));
    if (!routes.length) { setState('empty'); return; }

    let minLng = 180, minLat = 90, maxLng = -180, maxLat = -90, km = 0;
    const cells = new Set();
    for (const r of routes) {
      for (let i = 0; i < r.length; i++) {
        const [lng, lat] = r[i];
        if (lng < minLng) minLng = lng; if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat;
        if (i > 0) km += haversineKm(r[i - 1], r[i]);
        cells.add(cellKey(lng, lat));
      }
    }
    M.current.bounds = [[minLng, minLat], [maxLng, maxLat]];
    fitToRuns(true);
    setStats({ runs: routes.length, km, streets: cells.size });
    setState('ready');
  }

  function fitToRuns(instant) {
    const map = M.current.map, b = M.current.bounds;
    if (!map || !b) return;
    map.fitBounds(b, { padding: 54, maxZoom: 15, duration: instant ? 0 : 800 });
  }

  const miles = stats.km * 0.621371;

  return (
    <div className="mymap">
      <div className="mm-wrap">
        <div ref={mapEl} className="mapbox" />

        <div className="mm-head">
          <button className="mm-back" onClick={onClose} aria-label="Close">‹ Back</button>
          <div className="mm-title"><span className="mm-dot" /> Your map</div>
        </div>

        {state === 'ready' && M.current.bounds && (
          <button className="mm-fit" onClick={() => fitToRuns(false)} title="Fit all runs">◎ Fit</button>
        )}

        {state === 'ready' && (
          <div className="mm-stats">
            <div className="cs"><div className="n">{stats.runs.toLocaleString()}</div><div className="l">runs</div></div>
            <div className="cs"><div className="n">{miles < 10 ? miles.toFixed(1) : Math.round(miles).toLocaleString()}</div><div className="l">miles</div></div>
            <div className="cs"><div className="n">{stats.streets.toLocaleString()}</div><div className="l">streets</div></div>
          </div>
        )}

        {state === 'loading' && <div className="mm-note">Loading your map…</div>}
        {state === 'empty' && <div className="mm-note">No runs yet — go for a run and watch your map grow. 🏃</div>}
        {state === 'error' && <div className="mm-note">Couldn’t load your map right now.</div>}
      </div>
    </div>
  );
}
