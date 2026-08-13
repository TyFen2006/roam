import { createClient } from '@supabase/supabase-js';

// Keys come from .env (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) and the same
// values set as Netlify environment variables for the deployed build.
// The anon key is client-safe: it's protected by Row-Level Security in the DB.
const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

// If keys aren't set yet the client is null, so the app can still run and show a
// friendly "connect Supabase" state instead of crashing.
export const supabase = url && anon ? createClient(url, anon) : null;
export const hasSupabase = !!supabase;
