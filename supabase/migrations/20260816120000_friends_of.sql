-- ============================================================================
--  Friends-of-friends discovery
--  ---------------------------------------------------------------------------
--  Returns the *accepted* friends of any user, as profiles, so people can browse
--  a friend's friends and connect with runners they didn't know were on Roam.
--  Only exposes accepted friendships (never pending requests) and profile fields
--  that are already world-readable. SECURITY DEFINER so it can read across users.
-- ============================================================================
create or replace function public.friends_of(target uuid)
returns table(id uuid, display_name text, username text, avatar_url text, points int)
language sql stable security definer set search_path = public as $$
  select p.id, p.display_name, p.username, p.avatar_url, p.points
  from public.friendships f
  join public.profiles p
    on p.id = case when f.requester = target then f.addressee else f.requester end
  where f.status = 'accepted'
    and (f.requester = target or f.addressee = target)
  order by p.points desc nulls last;
$$;

grant execute on function public.friends_of(uuid) to anon, authenticated;
