// Friend invite links.  A link carries the inviter's profile id:
//   https://run-roam.netlify.app/?invite=<inviterId>
// When the recipient opens it and signs in, we create an already-accepted
// friendship (the shared link is the mutual consent) — no accept step needed.
// RLS allows this: the recipient is auth.uid() and inserts as `requester`.

const PENDING_KEY = 'roam.pendingInvite';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v) => typeof v === 'string' && UUID_RE.test(v);

export function buildInviteLink(userId) {
  const origin = typeof location !== 'undefined' ? location.origin : 'https://run-roam.netlify.app';
  return `${origin}/?invite=${userId}`;
}

// Read ?invite= from the URL on load, stash it so it survives the sign-up flow,
// and strip it from the address bar. Returns the pending inviter id (or null).
export function captureInvite() {
  let id = null;
  try {
    const u = new URL(location.href);
    const raw = u.searchParams.get('invite');
    if (raw) {
      if (u.searchParams.has('invite')) {
        u.searchParams.delete('invite');
        window.history.replaceState({}, '', u.pathname + u.search);
      }
      if (isUuid(raw)) { localStorage.setItem(PENDING_KEY, raw); id = raw; }
    } else {
      id = localStorage.getItem(PENDING_KEY);
    }
  } catch { /* ignore */ }
  return isUuid(id) ? id : null;
}

export function clearPendingInvite() {
  try { localStorage.removeItem(PENDING_KEY); } catch { /* ignore */ }
}

// Fetch an inviter's friendly name (for the "X invited you" banner). Works
// pre-auth because profiles are world-readable.
export async function fetchInviterName(supabase, inviterId) {
  if (!supabase || !isUuid(inviterId)) return '';
  const { data } = await supabase.from('profiles')
    .select('display_name,username').eq('id', inviterId).single();
  if (!data) return '';
  return data.display_name || (data.username ? '@' + data.username : '');
}

// Turn a pending invite into an accepted friendship. Idempotent and safe to
// call whenever a session exists. Returns { ok, already, skipped, error, name }.
export async function acceptInvite(supabase, inviterId, myId) {
  if (!supabase || !isUuid(inviterId) || !myId || inviterId === myId) return { skipped: true };
  try {
    // Any friendship already exists between us (either direction)?
    const { data: rows } = await supabase.from('friendships')
      .select('id,status')
      .or(`and(requester.eq.${myId},addressee.eq.${inviterId}),and(requester.eq.${inviterId},addressee.eq.${myId})`);
    const row = rows?.[0];
    if (row) {
      if (row.status === 'accepted') return { already: true, name: await fetchInviterName(supabase, inviterId) };
      // A pending request already exists in some direction — just accept it.
      const { error } = await supabase.from('friendships').update({ status: 'accepted' }).eq('id', row.id);
      if (error) return { error: error.message };
      return { ok: true, name: await fetchInviterName(supabase, inviterId) };
    }
    const { error } = await supabase.from('friendships')
      .insert({ requester: myId, addressee: inviterId, status: 'accepted' });
    if (error) {
      if (error.code === '23505') return { already: true }; // race: unique violation
      return { error: error.message };
    }
    return { ok: true, name: await fetchInviterName(supabase, inviterId) };
  } catch (e) {
    return { error: e.message || 'Could not accept invite' };
  }
}
