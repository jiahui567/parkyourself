import { accountMatch, SYNCED_TABLES, syncRows, syncState, toServerRow } from '../db';
import { settlesWithin, withTimeout } from '../lib/timeout';
import { DELETE_TIMED_OUT_TEXT, LOCAL_SYNC_ERROR_TEXT, SIGN_OUT_TIMED_OUT_TEXT, TIMED_OUT_TEXT } from '../text/cloudText';
import { deleteAccount, pushSyncedRows, signedInAccount, signOut, supabaseUrl } from './supabase';

// The sync (C3; PLAN.md, "How the sync works"), for now its push: the rows
// whose latest change has not reached the server go to the signed-in
// account's rows on Supabase. Photos and the local-only tables never go. It
// runs only while signed in: when the app opens or comes back to the front, a
// few seconds after a save, after Sign in, on Sync now and before Sign out,
// never in the background (src/hooks/useSync.js; a privacy exception the user
// chose on 2026-10-27, AGENTS.md "Privacy").

// Rows per call. Each row is a subtransaction on the server, and PostgreSQL
// slows down past 64 of them in one transaction, so a first sign-in with years
// of parking is many small calls rather than a few large ones.
export const PUSH_BATCH = 50;

// How long one call may take before the sync gives up on it. A call given up
// on may still arrive; pushing the same row again changes nothing.
export const CALL_TIMEOUT_MS = 20 * 1000;

// How long Sign out waits for its last push before asking anyway.
export const SIGN_OUT_WAIT_MS = 10 * 1000;

// How long Delete account may take: a few calls (the photos, then the
// account), so longer than one.
export const DELETE_TIMEOUT_MS = 60 * 1000;

// Every server call here goes through this, time-limited. Its errors are
// sentences for the user already (src/text/cloudText.js) and are marked as
// such; any other error is the phone's own database, whose text is not (see
// errorTextFor).
function serverCall(promise, ms, timedOutText) {
  return withTimeout(promise, ms, timedOutText).catch((e) => {
    const error = e instanceof Error ? e : new Error(String(e));
    throw Object.assign(error, { fromServer: true });
  });
}

const timed = (promise) => serverCall(promise, CALL_TIMEOUT_MS, TIMED_OUT_TEXT);

// What a screen shows for an error from this file's functions: the server's
// sentence, or LOCAL_SYNC_ERROR_TEXT for the phone's own database, whose raw
// text means nothing to the user (it goes to the console).
export function errorTextFor(error) {
  if (error?.fromServer) return String(error.message);
  console.warn('Error on the phone:', error);
  return LOCAL_SYNC_ERROR_TEXT;
}

// The signed-in account, { id, email } or null, kept on the phone for
// Settings. Time-limited: supabase-js lets one sign-in call run at a time, so
// a renewal hung on a weak signal would hold every one after it.
export async function loadAccount(db) {
  const account = await timed(signedInAccount());
  await syncState.setAccount(db, account);
  return account;
}

// Sign out (C2), time-limited for the same reason: supabase-js tells the
// server first and keeps the session until it answers. Given up on, the user
// is still signed in and can try again. The phone's rows, and the account
// they are backed up to, stay (PLAN.md, "How the sync works", step 9).
export async function signOutKeepingData(db) {
  await serverCall(signOut(), CALL_TIMEOUT_MS, SIGN_OUT_TIMED_OUT_TEXT);
  await syncState.setAccount(db, null);
}

// rows in lists of at most size, in order.
export function batches(rows, size) {
  const lists = [];
  for (let start = 0; start < rows.length; start += size) lists.push(rows.slice(start, start + size));
  return lists;
}

// The sync running now, if any, and whether another was asked for meanwhile:
// a save during a push may land after its table was read, so one more run
// follows instead of the change waiting for the next open of the app.
let running = null;
let askedAgain = false;

// Pushes what waits to be pushed. Never throws: a failure (no signal in a
// basement, a paused server) is kept for Settings and Account, and the next
// open, save or Sync now tries again. Returns what happened: { status }, one
// of 'not set up', 'signed out', 'other account', 'up to date', 'pushed' or
// 'failed'; 'pushed' also has refused, the rows the server refused.
export function syncNow(db) {
  if (running) {
    askedAgain = true;
    return running;
  }
  running = (async () => {
    let result;
    do {
      askedAgain = false;
      result = await pushChanges(db);
    } while (askedAgain);
    return result;
  })().finally(() => {
    running = null;
  });
  return running;
}

async function pushChanges(db) {
  if (!supabaseUrl) return { status: 'not set up' };
  try {
    // Nothing to send is no call at all, signed in or not. Unless the account
    // just signed in has the owner's email with a new id: the server lost this
    // phone's rows with the old account, so they all go again.
    const local = await syncState.get(db);
    if (local.pending === 0 && !local.restarting) return { status: 'up to date' };

    const account = await loadAccount(db);
    if (!account) return { status: 'signed out' };
    const owner = await syncState.owner(db);
    const match = accountMatch(owner, account);
    if (match === 'other') return { status: 'other account' };
    // 'same' with a changed email keeps the new one, so a later sign-up with
    // it is still recognised as the same person.
    if (match === 'first' || (match === 'same' && owner.email !== account.email)) {
      await syncState.setOwner(db, account);
    }
    if (match === 'recreated') await syncState.startOver(db, account);

    const refused = [];
    for (const table of SYNCED_TABLES) {
      const rows = await syncRows.listDirty(db, table);
      for (const batch of batches(rows, PUSH_BATCH)) {
        const refusedHere = await timed(pushSyncedRows(table, batch.map((row) => toServerRow(table, row))));
        const refusedIds = new Set(refusedHere.map((refusal) => refusal.id));
        // A refused row stays dirty, so it is tried again at every push.
        await syncRows.markPushed(db, table, batch.filter((row) => !refusedIds.has(row.id)));
        for (const refusal of refusedHere) {
          const row = batch.find((r) => r.id === refusal.id);
          refused.push({ table, updated_at: row?.updated_at ?? null, ...refusal });
        }
      }
    }
    await syncState.finished(db, Date.now(), refused);
    return { status: 'pushed', refused };
  } catch (e) {
    console.warn('Sync failed:', e);
    await syncState.failed(db, e?.fromServer ? String(e.message) : LOCAL_SYNC_ERROR_TEXT).catch((saveError) => {
      // Nothing else can be done: the screens that would show it read the same database.
      console.warn('Could not keep the sync error:', saveError);
    });
    return { status: 'failed', error: e };
  }
}

// Sign out's last push (PLAN.md, "How the sync works", step 9), waiting at
// most SIGN_OUT_WAIT_MS so a weak signal cannot hold Sign out. Returns how
// many of this account's changes have not reached it, for the warning: 0 when
// none wait, or when the phone's rows belong to another account.
export async function pushBeforeSignOut(db) {
  await settlesWithin(syncNow(db), SIGN_OUT_WAIT_MS);
  const state = await syncState.get(db);
  return state.otherAccount ? 0 : state.pending;
}

// Delete account (C2) with the sync's part: a push still running finishes
// first, since one that marked rows pushed after the reset would leave them
// clean while the server no longer has them. Throws when the server refuses
// the deletion, or takes over DELETE_TIMEOUT_MS: then the account may be gone
// or not, so the phone is not reset (an account made again with the same
// email is pushed everything anyway). Returns { localError }: null, or why
// the phone could not reset its backup although the account is gone.
export async function deleteAccountAndForget(db) {
  await running;
  await serverCall(deleteAccount(), DELETE_TIMEOUT_MS, DELETE_TIMED_OUT_TEXT);
  await running;
  try {
    await syncState.afterAccountDeleted(db);
    return { localError: null };
  } catch (e) {
    return { localError: e };
  }
}
