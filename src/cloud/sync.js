import { accountMatch, SYNCED_TABLES, syncPull, syncRows, syncState, tellPulledChange, toServerRow } from '../db';
import { settlesWithin, withTimeout } from '../lib/timeout';
import { DELETE_TIMED_OUT_TEXT, LOCAL_SYNC_ERROR_TEXT, SIGN_OUT_TIMED_OUT_TEXT, TIMED_OUT_TEXT } from '../text/cloudText';
import { deleteAccount, pullSyncedRows, pushSyncedRows, signedInAccount, signOut, supabaseUrl } from './supabase';

// The sync (C3, C4; PLAN.md, "How the sync works"): the push sends the rows
// whose latest change has not reached the server to the signed-in account's
// rows on Supabase, then the pull brings what the account's other phones
// changed (src/db/pull.js writes it and merges clashes). Photos and the
// local-only tables never go. It runs only while signed in: when the app
// opens or comes back to the front, a few seconds after a save, after Sign
// in, on Sync now and before Sign out (a push only), never in the background
// (src/hooks/useSync.js; a privacy exception the user chose on 2026-10-27,
// AGENTS.md "Privacy").

// Rows per call. Each row is a subtransaction on the server, and PostgreSQL
// slows down past 64 of them in one transaction, so a first sign-in with years
// of parking is many small calls rather than a few large ones.
export const PUSH_BATCH = 50;

// Rows per page of the pull: small enough to arrive on a weak signal within
// CALL_TIMEOUT_MS.
export const PULL_PAGE = 200;

// How far before where it is up to each pull reads again (PLAN.md, step 4):
// a row's stamp is when its push's transaction began, so a push that commits
// just after a pull read the table can carry an older stamp than what that
// pull got. A minute, in microseconds; a row pulled twice changes nothing.
export const PULL_OVERLAP_US = 60 * 1000 * 1000;

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
// Whether a run asked for meanwhile wants the pull too (Sign out's does not).
let pullAgain = false;

// Pushes what waits to be pushed, then pulls; with pull false, only pushes.
// Never throws: a failure (no signal in a basement, a paused server) is kept
// for Settings and Account, and the next open, save or Sync now tries again.
// Returns what happened: { status }, one of 'not set up', 'up to date' (a
// push alone, with nothing to send), 'signed out', 'other account', 'synced'
// or 'failed'; 'synced' also has refused, the rows
// the server refused at the last push, and pulled, how many rows the pull
// changed on this phone.
export function syncNow(db, { pull = true } = {}) {
  if (running) {
    askedAgain = true;
    pullAgain = pullAgain || pull;
    return running;
  }
  running = (async () => {
    let result;
    let withPull = pull;
    do {
      askedAgain = false;
      pullAgain = false;
      result = await sync(db, withPull);
      withPull = pullAgain;
    } while (askedAgain);
    return result;
  })().finally(() => {
    running = null;
  });
  return running;
}

// Sends the rows that wait, a table at a time, parents first. Returns the
// rows the server refused, each with its table and the updated_at sent.
async function pushChanges(db) {
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
  return refused;
}

// What the server changed for this account since each table's last pull,
// every page of it: { table: rows }. Nothing is written until all of it is in,
// so a place's rates are known when two places are merged.
async function fetchChanges(db) {
  const pulled = {};
  for (const table of SYNCED_TABLES) {
    const cursor = await syncPull.cursor(db, table);
    let afterUs = cursor == null ? null : cursor - PULL_OVERLAP_US;
    let afterId = null;
    const rows = [];
    for (;;) {
      const page = await timed(pullSyncedRows(table, { afterUs, afterId, limit: PULL_PAGE }));
      rows.push(...page);
      if (page.length < PULL_PAGE) break;
      afterUs = page[page.length - 1].server_updated_us;
      afterId = page[page.length - 1].id;
    }
    pulled[table] = rows;
  }
  return pulled;
}

async function sync(db, pull) {
  if (!supabaseUrl) return { status: 'not set up' };
  let pulled = 0;
  try {
    // A push alone with nothing to send makes no call at all, not even to
    // renew the session. Unless the account signed in has the owner's email
    // with a new id: the server lost this phone's rows, so they all go again.
    if (!pull) {
      const local = await syncState.get(db);
      if (local.pending === 0 && !local.restarting) return { status: 'up to date' };
    }
    // Signed out, this reads the phone's own storage and makes no call. Signed
    // in, every sync with the pull calls the server, even with nothing to push.
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

    // Push, then pull (PLAN.md, step 5). A second push follows at once when
    // the pull's merges changed rows, or when the server refused rows and the
    // pull changed something that may have freed them (the other phone's
    // parking ended), so neither waits for the next sync.
    let refused = await pushChanges(db);
    if (pull) {
      const { changed, dirtied } = await syncPull.apply(db, await fetchChanges(db));
      pulled = changed;
      if (dirtied > 0 || (refused.length > 0 && changed > 0)) refused = await pushChanges(db);
    }
    await syncState.finished(db, Date.now(), refused);
    return { status: 'synced', refused, pulled };
  } catch (e) {
    console.warn('Sync failed:', e);
    await syncState.failed(db, e?.fromServer ? String(e.message) : LOCAL_SYNC_ERROR_TEXT).catch((saveError) => {
      // Nothing else can be done: the screens that would show it read the same database.
      console.warn('Could not keep the sync error:', saveError);
    });
    return { status: 'failed', error: e };
  } finally {
    // Once the second push and the sync's state are saved, so the screen in
    // front shows how the sync ended (a refusal the second push cleared too).
    if (pulled > 0) tellPulledChange();
  }
}

// Sign out's last push (PLAN.md, "How the sync works", step 9), with no pull:
// what other phones changed is no use to a phone signing out. Waits at most
// SIGN_OUT_WAIT_MS so a weak signal cannot hold Sign out. Returns how many of
// this account's changes have not reached it, for the warning: 0 when none
// wait, or when the phone's rows belong to another account.
export async function pushBeforeSignOut(db) {
  await settlesWithin(syncNow(db, { pull: false }), SIGN_OUT_WAIT_MS);
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
