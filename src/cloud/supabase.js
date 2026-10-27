import { createClient, isAuthApiError } from '@supabase/supabase-js';
import { randomUUID } from 'expo-crypto';
import { File } from 'expo-file-system';
import Storage from 'expo-sqlite/kv-store';

import { cloudErrorText } from '../text/cloudText';

// The only code that calls @supabase/supabase-js. SQLite on the phone stays the
// main copy (PLAN.md, "Version 2"); Supabase is reached only from here.

// Inlined at build time from the env file of the build: .env.development.local
// for development builds, .env.production.local for release builds (see
// .env.example). A build without one has no server and makes no call.
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SET_UP = Boolean(SUPABASE_URL && PUBLISHABLE_KEY);

// Always signed out: the daily download never says who the user is. Its own
// storage key keeps it apart from the account's session.
const publicClient = SET_UP
  ? createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'public' },
    })
  : null;

// The signed-in user (C2). The session is kept in expo-sqlite's key-value
// store, a file of its own, so Export database never holds it. Nothing runs in
// the background: an expired token is renewed only when the user does
// something that needs the server, or when the sync runs while signed in
// (C3; AGENTS.md, "Privacy").
const accountClient = SET_UP
  ? createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
      auth: { storage: Storage, persistSession: true, autoRefreshToken: false, detectSessionInUrl: false },
    })
  : null;

// The server this build talks to, or null when none is set up.
export const supabaseUrl = SET_UP ? SUPABASE_URL : null;

const NOT_SET_UP = 'No Supabase server is set up. Copy .env.example to .env.development.local.';
const PHOTO_BUCKET = 'report-photos';

const userError = (error) => new Error(cloudErrorText(error));

function requireClient(client) {
  if (!client) throw new Error(NOT_SET_UP);
  return client;
}

const RATE_COLUMNS =
  'day_type, effective_from, type, first_minutes, first_sen, block_minutes, block_sen, grace_minutes, daily_cap_sen, flat_sen';

// The public car park list (PLAN.md, M12) in the shape of
// src/carparks/carParkList.json: { version: 'server', carParks }, each car
// park with its whole rate history. Read signed out, at most once a day
// (src/cloud/carParkUpdates.js, an exception the user chose: AGENTS.md, "Privacy").
export async function downloadCarParkList() {
  // A fixed order for car parks and their rates, so an unchanged list looks
  // the same each day and the phone's copy is not rewritten for nothing.
  const { data, error } = await requireClient(publicClient)
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

// Rate reports about listed car parks that wait for review (C10), with the
// car park list, signed out: [{ id, car_park_id, rates, created_at }].
// Row Level Security gives the signed-out only those; they cannot read the
// status, who sent a report, its note or its photo.
export async function downloadPendingReports() {
  const { data, error } = await requireClient(publicClient)
    .from('rate_report')
    .select('id, car_park_id, rates, created_at')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

// The saved session, renewed first if it has expired (which needs the
// server), or null when signed out. A renewal the server refuses (signed out
// elsewhere, account deleted) means signed out: supabase-js has already
// dropped the session. Only a failure to reach the server is an error.
async function currentSession() {
  const { data, error } = await requireClient(accountClient).auth.getSession();
  if (error && isAuthApiError(error)) return null;
  if (error) throw userError(error);
  return data.session;
}

async function requireSession() {
  const session = await currentSession();
  if (!session) throw new Error('Sign in with your email first.');
  return session;
}

// The signed-in user's email, or null when signed out.
export async function signedInEmail() {
  if (!accountClient) return null;
  return (await currentSession())?.user?.email ?? null;
}

const accountOf = (user) => (user ? { id: user.id, email: user.email ?? null } : null);

// The signed-in account, { id, email }, or null when signed out.
export async function signedInAccount() {
  if (!accountClient) return null;
  return accountOf((await currentSession())?.user);
}

// Emails a sign-in code; a new email gets an account with it (C2).
export async function sendSignInCode(email) {
  const { error } = await requireClient(accountClient).auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  if (error) throw userError(error);
}

// Returns the account signed in, { id, email }.
export async function signInWithCode(email, code) {
  const { data, error } = await requireClient(accountClient).auth.verifyOtp({ email, token: code, type: 'email' });
  if (error) throw userError(error);
  return accountOf(data.user);
}

// Signs this phone out; other phones on the account stay signed in.
export async function signOut() {
  const { error } = await requireClient(accountClient).auth.signOut({ scope: 'local' });
  if (error) throw userError(error);
}

// Pushes rows of one synced table as the signed-in user (C3), in the order
// given, each already in the server's shape (toServerRow in src/db/sync.js).
// The server keeps the newer of its row and each one sent, and refuses a row
// that breaks one of its rules without holding back the others
// (supabase/migrations/*_push_synced_rows.sql). Returns the refused rows:
// [{ id, code, constraint, other }].
export async function pushSyncedRows(table, rows) {
  await requireSession();
  const { data, error } = await accountClient.rpc('push_synced_rows', { p_table: table, p_rows: rows });
  if (error) throw userError(error);
  return data ?? [];
}

// Every path in the user's photo folder, a page at a time.
async function photoPaths(userId) {
  const bucket = accountClient.storage.from(PHOTO_BUCKET);
  const paths = [];
  const PAGE = 100;
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await bucket.list(userId, { limit: PAGE, offset });
    if (error) throw userError(error);
    paths.push(...data.map((file) => `${userId}/${file.name}`));
    if (data.length < PAGE) return paths;
  }
}

// Deletes the account: its report photos first, which the server refuses to
// leave behind, then the account, whose reports and synced rows the database
// deletes with it (supabase/migrations/*_rate_reports.sql, delete_my_account).
export async function deleteAccount() {
  const session = await requireSession();
  const paths = await photoPaths(session.user.id);
  if (paths.length) {
    const { error } = await accountClient.storage.from(PHOTO_BUCKET).remove(paths);
    if (error) throw userError(error);
  }
  const { error } = await accountClient.rpc('delete_my_account');
  if (error) throw userError(error);
  // The account is gone on the server; this forgets its session here.
  await signOut();
}

// Sends a rate report (C10) as the signed-in user: carParkId for a listed
// car park, else name (and lat and lng, if known) for a new one; rates as
// reportRatesFrom gives them; photoUri, a prepared JPEG, or null. The report
// goes first and names its photo, which the server then lets this user upload
// (no photo without a report). Throws when the report is refused; returns
// { photoError }, null when the photo (if any) arrived too, else why it did
// not: the report stands without it.
export async function sendReport({ carParkId = null, name, lat = null, lng = null, rates, note, photoUri = null }) {
  const session = await requireSession();
  const id = randomUUID();
  const photoPath = photoUri ? `${session.user.id}/${id}.jpg` : null;
  const { error } = await accountClient.from('rate_report').insert({
    id,
    car_park_id: carParkId,
    name: carParkId ? null : name,
    lat: carParkId ? null : lat,
    lng: carParkId ? null : lng,
    rates,
    note: note || null,
    photo_path: photoPath,
  });
  if (error) throw userError(error);
  if (!photoPath) return { photoError: null };
  try {
    const { error: uploadError } = await accountClient.storage
      .from(PHOTO_BUCKET)
      .upload(photoPath, await new File(photoUri).arrayBuffer(), { contentType: 'image/jpeg' });
    return { photoError: uploadError ? userError(uploadError) : null };
  } catch (e) {
    // Reading the file failed: the report is sent all the same.
    return { photoError: e };
  }
}

// The signed-in user's reports, newest first:
// [{ id, name, status, created_at }], name being the car park's.
export async function myReports() {
  await requireSession();
  const { data, error } = await accountClient
    .from('rate_report')
    .select('id, name, status, created_at, car_park(name)')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw userError(error);
  return data.map(({ car_park: carPark, ...report }) => ({ ...report, name: carPark?.name ?? report.name }));
}
