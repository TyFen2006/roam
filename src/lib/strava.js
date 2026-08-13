import { supabase } from './supabase.js';

const CLIENT_ID = import.meta.env.VITE_STRAVA_CLIENT_ID;
export const stravaConfigured = !!CLIENT_ID;

export function stravaAuthUrl() {
  const p = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: window.location.origin + '/',
    response_type: 'code',
    scope: 'activity:read',
    approval_prompt: 'auto',
  });
  return 'https://www.strava.com/oauth/authorize?' + p.toString();
}

async function fn(payload) {
  const r = await fetch('/.netlify/functions/strava', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return r.json();
}
export const stravaExchange = (code) => fn({ action: 'exchange', code });
export const stravaRefresh = (refresh_token) => fn({ action: 'refresh', refresh_token });
export const stravaActivities = (access_token) => fn({ action: 'activities', access_token });

// Decode a Google/Strava encoded polyline → [[lng, lat], ...]
export function decodePolyline(str, precision = 5) {
  let index = 0, lat = 0, lng = 0;
  const coords = [], factor = Math.pow(10, precision);
  while (index < str.length) {
    let result = 1, shift = 0, b;
    do { b = str.charCodeAt(index++) - 63 - 1; result += b << shift; shift += 5; } while (b >= 0x1f);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);
    result = 1; shift = 0;
    do { b = str.charCodeAt(index++) - 63 - 1; result += b << shift; shift += 5; } while (b >= 0x1f);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);
    coords.push([lng / factor, lat / factor]);
  }
  return coords;
}

// Make sure we have a valid access token, refreshing if it's about to expire.
export async function ensureToken(userId) {
  const { data } = await supabase.from('strava_accounts').select('*').eq('user_id', userId).maybeSingle();
  if (!data) return null;
  if (data.expires_at && data.expires_at * 1000 < Date.now() + 60000) {
    const t = await stravaRefresh(data.refresh_token);
    if (t && t.access_token) {
      await supabase.from('strava_accounts')
        .update({ access_token: t.access_token, refresh_token: t.refresh_token, expires_at: t.expires_at })
        .eq('user_id', userId);
      return t.access_token;
    }
    return null;
  }
  return data.access_token;
}

// Fetch recent Strava runs and save the new ones as Roam runs.
export async function importFromStrava(userId) {
  const token = await ensureToken(userId);
  if (!token) throw new Error('Connect Strava first');
  const acts = await stravaActivities(token);
  if (!Array.isArray(acts)) throw new Error(acts?.message || acts?.error || 'Strava error');

  const runs = acts.filter(a => (a.type === 'Run' || a.sport_type === 'Run') && a.map && a.map.summary_polyline);
  if (!runs.length) return { imported: 0, total: acts.length };

  const ids = runs.map(a => a.id);
  const { data: existing } = await supabase.from('runs').select('strava_id').eq('user_id', userId).in('strava_id', ids);
  const have = new Set((existing || []).map(r => r.strava_id));

  const rows = [];
  for (const a of runs) {
    if (have.has(a.id)) continue;
    const route = decodePolyline(a.map.summary_polyline);
    if (route.length < 2) continue;
    const cells = new Set();
    for (const [lng, lat] of route) cells.add(Math.round(lng / 0.0007) + ',' + Math.round(lat / 0.0007));
    rows.push({
      user_id: userId,
      route,
      mood: 'Imported',
      distance_km: +((a.distance || 0) / 1000).toFixed(3),
      points: cells.size * 15,
      cells: cells.size,
      strava_id: a.id,
    });
  }
  if (rows.length) {
    const { error } = await supabase.from('runs').insert(rows);
    if (error) throw error;
  }
  return { imported: rows.length, total: runs.length };
}
