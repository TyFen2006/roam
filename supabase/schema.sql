-- Roam · Supabase schema
-- Phase 1: Accounts. Run this in the Supabase dashboard → SQL Editor → New query → Run.
-- (We'll add runs / friends / groups tables in later phases.)

-- ── Profiles ────────────────────────────────────────────────────────────────
-- One row per user, linked to Supabase's built-in auth.users table.
create table if not exists public.profiles (
  id           uuid primary key references auth.users on delete cascade,
  username     text unique,
  display_name text,
  rank         text default 'Wanderer',
  level        int  default 1,
  created_at   timestamptz default now()
);

-- Row-Level Security: everyone can read profiles (for friend lists/leaderboards),
-- but you can only create/edit your own.
alter table public.profiles enable row level security;

drop policy if exists "profiles are viewable by everyone" on public.profiles;
create policy "profiles are viewable by everyone"
  on public.profiles for select using (true);

drop policy if exists "users insert own profile" on public.profiles;
create policy "users insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile"
  on public.profiles for update using (auth.uid() = id);

-- ── Auto-create a profile when someone signs up ─────────────────────────────
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
