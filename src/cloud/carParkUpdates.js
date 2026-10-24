import { isCheckDue } from '../carparks/schedule';
import { carParks, settings } from '../db';
import { downloadCarParkList, supabaseUrl } from './supabase';

// The daily download of the car park list (PLAN.md, M12; a privacy exception
// the user chose, AGENTS.md "Privacy").

const CHECKED_AT_KEY = 'car_park_list_checked_at';

// Downloads the list when a day has passed since the last try, and stores it
// on the phone when it changed. The try is recorded first, so a failure (no
// signal, a paused server) waits a day too instead of trying on every open.
// Never throws: the list is optional, so a failure is logged and kept for
// Database check. Returns what happened, for the tests: 'not set up',
// 'not due', 'updated', 'unchanged' or 'failed'.
// The check in progress, if any: opening the app and its coming to the front
// can ask at the same moment, and both would download.
let inFlight = null;

export function updateCarParkListIfDue(db, nowMs) {
  inFlight ??= checkAndUpdate(db, nowMs).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function checkAndUpdate(db, nowMs) {
  if (!supabaseUrl) return 'not set up';
  try {
    if (!isCheckDue(Number(await settings.get(db, CHECKED_AT_KEY)), nowMs)) return 'not due';
    await settings.set(db, CHECKED_AT_KEY, String(nowMs));
    const replaced = await carParks.refresh(db, await downloadCarParkList(), 'server');
    await carParks.setLastError(db, '');
    return replaced ? 'updated' : 'unchanged';
  } catch (e) {
    console.warn('Car park list not downloaded:', e);
    await carParks.setLastError(db, `Download: ${String(e?.message ?? e)}`).catch((saveError) => {
      // Nothing else can be done: the screen that would show it reads the same database.
      console.warn('Could not keep the download error:', saveError);
    });
    return 'failed';
  }
}
