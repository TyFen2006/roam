-- ============================================================================
--  ROAM · Supabase schema
--  ---------------------------------------------------------------------------
--  One file, safe to re-run (idempotent). To use: Supabase → SQL Editor →
--  New query → paste → Run. Save it as a named query: "Roam — Schema".
--
--  Sections:   1) Profiles      2) Avatars (storage)      3) Runs
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
--  1 · PROFILES  — one row per user, linked to Supabase auth
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id           uuid primary key references auth.users on delete cascade,
  username     text unique,
  display_name text,
  avatar_url   text,
  rank         text default 'Wanderer',
  level        int  default 1,
  created_at   timestamptz default now()
);

alter table public.profiles enable row level security;

-- remove earlier ad-hoc policy names so we don't stack duplicates
drop policy if exists "profiles are viewable by everyone" on public.profiles;
drop policy if exists "users insert own profile" on public.profiles;
drop policy if exists "users update own profile" on public.profiles;

drop policy if exists "profiles: anyone can read" on public.profiles;
create policy "profiles: anyone can read"
  on public.profiles for select using (true);

drop policy if exists "profiles: insert own" on public.profiles;
create policy "profiles: insert own"
  on public.profiles for insert with check (auth.uid() = id);

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own"
  on public.profiles for update using (auth.uid() = id);

-- Auto-create a profile whenever someone signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ────────────────────────────────────────────────────────────────────────────
--  2 · AVATARS  — profile photos, stored in a public Storage bucket
-- ────────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- remove earlier ad-hoc policy names
drop policy if exists "avatars public read" on storage.objects;
drop policy if exists "avatars user upload" on storage.objects;
drop policy if exists "avatars user update" on storage.objects;

drop policy if exists "avatars: public read" on storage.objects;
create policy "avatars: public read"
  on storage.objects for select using (bucket_id = 'avatars');

drop policy if exists "avatars: upload own" on storage.objects;
create policy "avatars: upload own"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars: update own" on storage.objects;
create policy "avatars: update own"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);


-- ────────────────────────────────────────────────────────────────────────────
--  3 · RUNS  — each recorded run, synced to the account (Phase 2)
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.runs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users on delete cascade,
  route        jsonb not null,            -- array of [lng, lat] points
  mood         text,
  distance_km  numeric default 0,
  points       int     default 0,
  cells        int     default 0,
  created_at   timestamptz default now()
);

create index if not exists runs_user_idx on public.runs (user_id);

alter table public.runs enable row level security;

-- remove earlier ad-hoc policy names
drop policy if exists "users read own runs" on public.runs;
drop policy if exists "users insert own runs" on public.runs;
drop policy if exists "users delete own runs" on public.runs;

drop policy if exists "runs: read own" on public.runs;
create policy "runs: read own"
  on public.runs for select using (auth.uid() = user_id);

drop policy if exists "runs: insert own" on public.runs;
create policy "runs: insert own"
  on public.runs for insert with check (auth.uid() = user_id);

drop policy if exists "runs: delete own" on public.runs;
create policy "runs: delete own"
  on public.runs for delete using (auth.uid() = user_id);


-- ────────────────────────────────────────────────────────────────────────────
--  4 · FRIENDS  — real friendships + a points total for leaderboards (Phase 3a)
-- ────────────────────────────────────────────────────────────────────────────
-- running point total on each profile (kept in sync by the trigger below)
alter table public.profiles add column if not exists points int default 0;

create table if not exists public.friendships (
  id         uuid primary key default gen_random_uuid(),
  requester  uuid not null references public.profiles(id) on delete cascade,
  addressee  uuid not null references public.profiles(id) on delete cascade,
  status     text not null default 'pending',    -- 'pending' | 'accepted'
  created_at timestamptz default now(),
  unique (requester, addressee),
  check (requester <> addressee)
);
create index if not exists friendships_addressee_idx on public.friendships (addressee);
create index if not exists friendships_requester_idx on public.friendships (requester);

alter table public.friendships enable row level security;

drop policy if exists "friendships: read involved" on public.friendships;
create policy "friendships: read involved" on public.friendships for select
  using (auth.uid() = requester or auth.uid() = addressee);

drop policy if exists "friendships: send own request" on public.friendships;
create policy "friendships: send own request" on public.friendships for insert
  with check (auth.uid() = requester);

drop policy if exists "friendships: update involved" on public.friendships;
create policy "friendships: update involved" on public.friendships for update
  using (auth.uid() = requester or auth.uid() = addressee);

drop policy if exists "friendships: delete involved" on public.friendships;
create policy "friendships: delete involved" on public.friendships for delete
  using (auth.uid() = requester or auth.uid() = addressee);

-- keep profiles.points in sync as runs are added / removed
create or replace function public.bump_profile_points()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT') then
    update public.profiles set points = coalesce(points,0) + coalesce(new.points,0) where id = new.user_id;
  elsif (tg_op = 'DELETE') then
    update public.profiles set points = greatest(0, coalesce(points,0) - coalesce(old.points,0)) where id = old.user_id;
  end if;
  return null;
end; $$;

drop trigger if exists on_run_change on public.runs;
create trigger on_run_change
  after insert or delete on public.runs
  for each row execute function public.bump_profile_points();


-- ────────────────────────────────────────────────────────────────────────────
--  5 · GROUPS  — create / join crews with point leaderboards (Phase 3b)
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.groups (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  emoji      text,
  blurb      text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);
alter table public.groups enable row level security;

drop policy if exists "groups: read all" on public.groups;
create policy "groups: read all" on public.groups for select using (true);

drop policy if exists "groups: create own" on public.groups;
create policy "groups: create own" on public.groups for insert with check (auth.uid() = created_by);

drop policy if exists "groups: update own" on public.groups;
create policy "groups: update own" on public.groups for update using (auth.uid() = created_by);

drop policy if exists "groups: delete own" on public.groups;
create policy "groups: delete own" on public.groups for delete using (auth.uid() = created_by);

create table if not exists public.group_members (
  group_id  uuid not null references public.groups(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz default now(),
  primary key (group_id, user_id)
);
alter table public.group_members enable row level security;

drop policy if exists "group_members: read all" on public.group_members;
create policy "group_members: read all" on public.group_members for select using (true);

drop policy if exists "group_members: join self" on public.group_members;
create policy "group_members: join self" on public.group_members for insert with check (auth.uid() = user_id);

drop policy if exists "group_members: leave self" on public.group_members;
create policy "group_members: leave self" on public.group_members for delete using (auth.uid() = user_id);


-- ────────────────────────────────────────────────────────────────────────────
--  6 · STRAVA  — import runs recorded on Strava
-- ────────────────────────────────────────────────────────────────────────────
-- de-dupe imported runs
alter table public.runs add column if not exists strava_id bigint;
create index if not exists runs_strava_idx on public.runs (user_id, strava_id);

-- per-user Strava tokens (readable only by the owner)
create table if not exists public.strava_accounts (
  user_id       uuid primary key references public.profiles(id) on delete cascade,
  athlete_id    bigint,
  access_token  text,
  refresh_token text,
  expires_at    bigint,
  connected_at  timestamptz default now()
);
alter table public.strava_accounts enable row level security;

drop policy if exists "strava: read own" on public.strava_accounts;
create policy "strava: read own" on public.strava_accounts for select using (auth.uid() = user_id);

drop policy if exists "strava: insert own" on public.strava_accounts;
create policy "strava: insert own" on public.strava_accounts for insert with check (auth.uid() = user_id);

drop policy if exists "strava: update own" on public.strava_accounts;
create policy "strava: update own" on public.strava_accounts for update using (auth.uid() = user_id);


-- ────────────────────────────────────────────────────────────────────────────
--  7 · REWARDS  — quest claims, earned patches, atomic points bump
-- ────────────────────────────────────────────────────────────────────────────
-- one claim per (user, quest, week) so a weekly reward is granted only once
create table if not exists public.quest_claims (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  quest_id   text not null,
  week       date not null,
  created_at timestamptz default now(),
  primary key (user_id, quest_id, week)
);
alter table public.quest_claims enable row level security;
drop policy if exists "quest_claims: read own" on public.quest_claims;
create policy "quest_claims: read own" on public.quest_claims for select using (auth.uid() = user_id);
drop policy if exists "quest_claims: insert own" on public.quest_claims;
create policy "quest_claims: insert own" on public.quest_claims for insert with check (auth.uid() = user_id);

-- permanent collectible patches
create table if not exists public.user_patches (
  user_id   uuid not null references public.profiles(id) on delete cascade,
  patch_key text not null,
  earned_at timestamptz default now(),
  primary key (user_id, patch_key)
);
alter table public.user_patches enable row level security;
drop policy if exists "user_patches: read all" on public.user_patches;
create policy "user_patches: read all" on public.user_patches for select using (true);
drop policy if exists "user_patches: insert own" on public.user_patches;
create policy "user_patches: insert own" on public.user_patches for insert with check (auth.uid() = user_id);

-- atomic bonus-points bump on the caller's own profile
create or replace function public.increment_points(amt int)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set points = coalesce(points, 0) + amt where id = auth.uid();
end; $$;


-- ────────────────────────────────────────────────────────────────────────────
--  8 · QUEST SPOTS  — the weekly "run to a spot" destination
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.quest_spots (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  week       date not null,
  lng        double precision not null,
  lat        double precision not null,
  reached    boolean default false,
  created_at timestamptz default now(),
  primary key (user_id, week)
);
alter table public.quest_spots enable row level security;
drop policy if exists "quest_spots: read own" on public.quest_spots;
create policy "quest_spots: read own" on public.quest_spots for select using (auth.uid() = user_id);
drop policy if exists "quest_spots: insert own" on public.quest_spots;
create policy "quest_spots: insert own" on public.quest_spots for insert with check (auth.uid() = user_id);
drop policy if exists "quest_spots: update own" on public.quest_spots;
create policy "quest_spots: update own" on public.quest_spots for update using (auth.uid() = user_id);

-- name of the road the spot sits on (from OSRM), so we can say "Run to Mill Road"
alter table public.quest_spots add column if not exists name text;


-- ────────────────────────────────────────────────────────────────────────────
--  9 · TERRITORY  — own streets; friends can take them back (the territory game)
-- ────────────────────────────────────────────────────────────────────────────
-- how many times each user has run through each grid cell
create table if not exists public.territory (
  cell       text not null,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  visits     int default 1,
  updated_at timestamptz default now(),
  primary key (cell, user_id)
);
alter table public.territory enable row level security;
drop policy if exists "territory: read all" on public.territory;
create policy "territory: read all" on public.territory for select using (true);
drop policy if exists "territory: insert own" on public.territory;
create policy "territory: insert own" on public.territory for insert with check (auth.uid() = user_id);
drop policy if exists "territory: update own" on public.territory;
create policy "territory: update own" on public.territory for update using (auth.uid() = user_id);

-- the current owner of each cell = whoever has run it most
create or replace view public.cell_owners as
  select distinct on (cell) cell, user_id, visits
  from public.territory
  order by cell, visits desc, updated_at desc;

-- record a run's cells for the caller (increments their visit counts)
create or replace function public.claim_cells(cells text[])
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.territory (cell, user_id, visits)
  select c, auth.uid(), 1 from unnest(cells) as c
  on conflict (cell, user_id) do update set visits = public.territory.visits + 1, updated_at = now();
end; $$;

-- cells the caller has visited, flagged mine=true if they currently own it
create or replace function public.my_territory()
returns table(cell text, mine boolean) language sql security definer set search_path = public as $$
  select t.cell, (co.user_id = auth.uid()) as mine
  from (select distinct cell from public.territory where user_id = auth.uid()) t
  join public.cell_owners co on co.cell = t.cell;
$$;
