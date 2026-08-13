// Server-side Strava helper (runs on Netlify, holds the client secret).
// Actions: exchange (code -> tokens), refresh (refresh_token -> tokens), activities.
export const handler = async (event) => {
  const CLIENT_ID = process.env.VITE_STRAVA_CLIENT_ID;
  const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors, body: '' };

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch { /* ignore */ }
  const { action } = body;

  if (!CLIENT_ID || !CLIENT_SECRET) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: 'Strava keys not configured on the server' }) };
  }

  try {
    if (action === 'exchange' || action === 'refresh') {
      const params = new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: action === 'exchange' ? 'authorization_code' : 'refresh_token',
      });
      if (action === 'exchange') params.set('code', body.code || '');
      else params.set('refresh_token', body.refresh_token || '');
      const r = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params,
      });
      return { statusCode: r.status, headers: cors, body: await r.text() };
    }

    if (action === 'activities') {
      const r = await fetch('https://www.strava.com/api/v3/athlete/activities?per_page=40', {
        headers: { Authorization: `Bearer ${body.access_token}` },
      });
      return { statusCode: r.status, headers: cors, body: await r.text() };
    }

    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'unknown action' }) };
  } catch (e) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: e.message }) };
  }
};
