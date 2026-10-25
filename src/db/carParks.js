import { ratesInEffect } from '../carparks/ratesInEffect';
import { feeFields } from '../fees';
import { inTransaction } from './core';
import { assertPlaceRate, escapeLike } from './places';
import { settings } from './settings';

// The car park list (PLAN.md, M11 and M12): reference data kept in the
// local-only car_park tables. It comes from Supabase (a daily download, see
// src/cloud/carParkUpdates.js) or, until a download has worked, from the copy
// built into the app. Nothing here makes a network call.

// '<source>:<version>#<fingerprint>' of the list stored, source 'bundled' or 'server'.
const LIST_STAMP_KEY = 'car_park_list_version';
const LIST_ERROR_KEY = 'car_park_list_error';
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

// A short fingerprint of the list's content (djb2), so an edit that forgets
// to change the version still reaches the phone.
function fingerprint(carParksList) {
  const text = JSON.stringify(carParksList);
  let hash = 5381;
  for (let i = 0; i < text.length; i++) hash = (hash * 33 + text.charCodeAt(i)) >>> 0;
  return hash.toString(36);
}

// Throws on the first car park in list that cannot be stored, naming it, so a
// mistake in the data fails in the tests, or a bad download is refused whole.
export function assertCarParkList(list) {
  if (!list?.version || !Array.isArray(list.carParks)) throw new Error('The car park list needs a version and car parks.');
  const ids = new Set();
  for (const carPark of list.carParks) {
    const where = `Car park ${carPark.id ?? carPark.name}`;
    if (!carPark.id || !carPark.name) throw new Error(`${where} needs an id and a name.`);
    if (ids.has(carPark.id)) throw new Error(`${where} is listed twice.`);
    ids.add(carPark.id);
    if (!carPark.source_url || !DATE_KEY.test(carPark.checked_on ?? '')) {
      throw new Error(`${where} needs a source_url and checked_on as YYYY-MM-DD.`);
    }
    const seen = new Set();
    for (const rate of carPark.rates ?? []) {
      const at = `${where}, ${rate.day_type} from ${rate.effective_from ?? 'the start'}`;
      if (rate.effective_from != null && !DATE_KEY.test(rate.effective_from)) {
        throw new Error(`${at}: effective_from must be YYYY-MM-DD.`);
      }
      // A missing effective_from and null are both stored as NULL.
      const key = `${rate.day_type}|${rate.effective_from ?? ''}`;
      if (seen.has(key)) throw new Error(`${at} is listed twice.`);
      seen.add(key);
      try {
        assertPlaceRate(rate.day_type, rate);
      } catch (e) {
        throw new Error(`${at}: ${e.message}`);
      }
    }
  }
}

async function replaceList(db, list, stamp) {
  await inTransaction(db, async (txn) => {
    await txn.runAsync('DELETE FROM car_park_rate');
    await txn.runAsync('DELETE FROM car_park');
    for (const c of list.carParks) {
      await txn.runAsync(
        `INSERT INTO car_park (id, name, area, lat, lng, source_url, checked_on, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [c.id, c.name, c.area ?? null, c.lat ?? null, c.lng ?? null, c.source_url, c.checked_on, c.notes ?? null]
      );
      for (const rate of c.rates ?? []) {
        const fields = feeFields(rate);
        const columns = Object.keys(fields);
        await txn.runAsync(
          `INSERT INTO car_park_rate (car_park_id, day_type, effective_from, ${columns.join(', ')})
           VALUES (?, ?, ?, ${columns.map(() => '?').join(', ')})`,
          [c.id, rate.day_type, rate.effective_from ?? null, ...columns.map((column) => fields[column])]
        );
      }
    }
    await settings.set(txn, LIST_STAMP_KEY, stamp);
  });
}

export const carParks = {
  // Stores list, from source 'bundled' (built into the app) or 'server' (a
  // download), when it differs from the stored one. A downloaded list is never
  // replaced by the built-in copy: the server is newer. Returns true when it
  // replaced the stored list. All or nothing.
  async refresh(db, list, source = 'bundled') {
    assertCarParkList(list);
    const stamp = `${source}:${list.version}#${fingerprint(list.carParks)}`;
    const stored = await settings.get(db, LIST_STAMP_KEY);
    if (stored === stamp) return false;
    if (source === 'bundled' && stored?.startsWith('server:')) return false;
    await replaceList(db, list, stamp);
    return true;
  },

  // refresh with the built-in copy when the app starts. The list is optional,
  // so a failure must not stop the app from opening: it keeps the list it had
  // and the error is kept for the Database check screen (info). An earlier
  // error (a failed download) is cleared only when this start stored a list.
  async refreshAtStart(db, list) {
    try {
      if (await carParks.refresh(db, list, 'bundled')) await settings.set(db, LIST_ERROR_KEY, '');
    } catch (e) {
      console.warn('Car park list not refreshed:', e);
      await settings.set(db, LIST_ERROR_KEY, String(e?.message ?? e));
    }
  },

  // Keeps an error from refreshing or downloading the list for Database
  // check; '' clears it.
  setLastError: (db, message) => settings.set(db, LIST_ERROR_KEY, message ?? ''),

  // For Database check: { source ('bundled', 'server' or null), carParks, rates, error }.
  async info(db) {
    const [stamp, error, counts] = await Promise.all([
      settings.get(db, LIST_STAMP_KEY),
      settings.get(db, LIST_ERROR_KEY),
      db.getFirstAsync('SELECT (SELECT COUNT(*) FROM car_park) AS carParks, (SELECT COUNT(*) FROM car_park_rate) AS rates'),
    ]);
    return { source: stamp ? stamp.split(':')[0] : null, ...counts, error: error || null };
  },

  // Listed car parks whose name or area contains query (any case; the area
  // also holds a mall's former name), leaving out ones already saved as a
  // place: the saved place, with your own rates, wins.
  search(db, query, { limit = 8 } = {}) {
    const pattern = `%${escapeLike(String(query ?? '').trim())}%`;
    return db.getAllAsync(
      `SELECT c.* FROM car_park c
       WHERE (c.name LIKE ? ESCAPE '\\' OR c.area LIKE ? ESCAPE '\\')
         AND NOT EXISTS (SELECT 1 FROM place p WHERE p.deleted_at IS NULL AND p.name = c.name COLLATE NOCASE)
       ORDER BY c.name COLLATE NOCASE
       LIMIT ?`,
      [pattern, pattern, limit]
    );
  },

  // Every listed car park with a location, for finding the one the car is at.
  // place_id and place_name are the saved place with the same name, or null:
  // a place saved before the location was on has no location of its own, and
  // is still found through the list.
  listLocated(db) {
    return db.getAllAsync(
      `SELECT c.id, c.name, c.lat, c.lng, p.id AS place_id, p.name AS place_name
       FROM car_park c
       LEFT JOIN place p ON p.deleted_at IS NULL AND p.name = c.name COLLATE NOCASE
       WHERE c.lat IS NOT NULL AND c.lng IS NOT NULL
       ORDER BY c.name COLLATE NOCASE`
    );
  },

  // The listed car park with this name (any case), as carParks.get gives it,
  // or null: for a name typed on Park but never tapped.
  async findByName(db, name, todayKey) {
    const row = await db.getFirstAsync('SELECT id FROM car_park WHERE name = ? COLLATE NOCASE', [
      String(name ?? '').trim(),
    ]);
    return row ? carParks.get(db, row.id, todayKey) : null;
  },

  // The car park with the rates in effect on todayKey ('YYYY-MM-DD') as
  // { weekday, weekend, holiday } (place_rate shaped, each a row or null),
  // effective_from, the latest start among them, and reports, the users'
  // reports waiting for review (pendingReports); or null when it is not listed.
  async get(db, id, todayKey) {
    const carPark = await db.getFirstAsync('SELECT * FROM car_park WHERE id = ?', [id]);
    if (!carPark) return null;
    const rows = await db.getAllAsync('SELECT * FROM car_park_rate WHERE car_park_id = ?', [id]);
    const { effective_from, ...rates } = ratesInEffect(rows, todayKey);
    return { ...carPark, rates, effective_from, reports: await carParks.pendingReports(db, id) };
  },

  // Replaces the stored rate reports waiting for review (C10) with reports
  // (readPendingReports in src/carparks/reports.js), leaving out any about a
  // car park the stored list does not have. All or nothing.
  async replaceReports(db, reports) {
    await inTransaction(db, async (txn) => {
      await txn.runAsync('DELETE FROM car_park_report');
      for (const r of reports) {
        await txn.runAsync(
          `INSERT INTO car_park_report (id, car_park_id, rates, reported_at)
           SELECT ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM car_park WHERE id = ?)`,
          [r.id, r.car_park_id, JSON.stringify(r.rates), r.reported_at, r.car_park_id]
        );
      }
    });
  },

  // The car park's reports waiting for review, newest first:
  // [{ id, car_park_id, rates, reported_at }], rates as an object.
  async pendingReports(db, carParkId) {
    const rows = await db.getAllAsync(
      'SELECT * FROM car_park_report WHERE car_park_id = ? ORDER BY reported_at DESC, id',
      [carParkId]
    );
    return rows.map((row) => ({ ...row, rates: JSON.parse(row.rates) }));
  },
};
