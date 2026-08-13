// Two-letter initials from a name or email, for avatar fallbacks.
export function initials(s) {
  if (!s) return '?';
  const str = String(s).trim();
  const parts = str.split(/\s+/);
  if (parts.length >= 2 && parts[0] && parts[1]) return (parts[0][0] + parts[1][0]).toUpperCase();
  return str.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase() || '?';
}
