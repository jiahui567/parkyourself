import { createClient } from '@supabase/supabase-js';

// The only code that calls @supabase/supabase-js. SQLite on the phone stays the
// main copy (PLAN.md, "Version 2"); Supabase is reached only from here.

// Inlined at build time from the env file of the build: .env.development.local
// for development builds, .env.production.local for release builds (see
// .env.example). A build without one has no server and makes no call.
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// Nobody signs in until C2, so there is no session to keep or refresh yet.
const client =
  SUPABASE_URL && PUBLISHABLE_KEY
    ? createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      })
    : null;

// The server this build talks to, or null when none is set up.
export const supabaseUrl = client ? SUPABASE_URL : null;

const NOT_SET_UP = 'No Supabase server is set up. Copy .env.example to .env.development.local.';

// C0 only: reads the one row of connection_check, signed out, to prove the app
// reaches the server. Only when the user taps Check connection (AGENTS.md, "Privacy").
export async function readConnectionCheck() {
  if (!client) throw new Error(NOT_SET_UP);
  const { data, error } = await client.from('connection_check').select('message').eq('id', 1).single();
  if (error) throw new Error(error.message);
  return data.message;
}

const RATE_COLUMNS =
  'day_type, effective_from, type, first_minutes, first_sen, block_minutes, block_sen, grace_minutes, daily_cap_sen, flat_sen';

// The public car park list (PLAN.md, M12) in the shape of
// src/carparks/carParkList.json: { version: 'server', carParks }, each car
// park with its whole rate history. Read signed out, at most once a day
// (src/cloud/carParkUpdates.js, an exception the user chose: AGENTS.md, "Privacy").
export async function downloadCarParkList() {
  if (!client) throw new Error(NOT_SET_UP);
  // A fixed order for car parks and their rates, so an unchanged list looks
  // the same each day and the phone's copy is not rewritten for nothing.
  const { data, error } = await client
    .from('car_park')
    .select(`id, name, area, lat, lng, source_url, checked_on, notes, rates:car_park_rate(${RATE_COLUMNS})`)
    .order('id')
    .order('day_type', { referencedTable: 'rates' })
    .order('effective_from', { referencedTable: 'rates', nullsFirst: true });
  if (error) throw new Error(error.message);
  // An empty list is a server not set up yet (or reset), not "no car parks":
  // keeping the phone's copy is better than wiping it.
  if (!data?.length) throw new Error('The server has no car park list.');
  return { version: 'server', carParks: data };
}
