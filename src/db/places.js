import { assertValidRate, DAY_TYPES, feeFields } from '../fees';
import { inTransaction, now, softDeleteRow, syncedTable } from './core';

export const placeRates = syncedTable('place_rate');

const base = syncedTable('place');

// Throws unless rate can be saved for dayType. The schema only allows a flat
// holiday rate; checking here gives the user a sentence instead of a CHECK error.
export function assertPlaceRate(dayType, rate) {
  if (!DAY_TYPES.includes(dayType)) throw new Error(`Unknown day type: ${dayType}`);
  if (dayType === 'holiday' && rate?.type !== 'flat') {
    throw new Error('A public holiday amount must be a flat price per entry.');
  }
  assertValidRate(rate);
}

// LIKE treats % and _ as wildcards; a typed one should match only itself.
// Use with ESCAPE '\\'.
export const escapeLike = (text) => text.replace(/[\\%_]/g, '\\$&');

// The helpers below take the connection they are given (db, or txn inside a
// transaction) and never open a transaction themselves, so sessions.start and
// sessions.end can call them inside theirs.

// The live place with this name, ignoring case and surrounding spaces, or null.
function findByName(db, name) {
  const trimmed = String(name ?? '').trim();
  if (!trimmed) return Promise.resolve(null);
  return db.getFirstAsync('SELECT * FROM place WHERE deleted_at IS NULL AND name = ? COLLATE NOCASE', [
    trimmed,
  ]);
}

// { weekday, weekend, holiday }, each the live place_rate row or null.
async function getRates(db, placeId) {
  const rows = await db.getAllAsync('SELECT * FROM place_rate WHERE place_id = ? AND deleted_at IS NULL', [
    placeId,
  ]);
  const rates = { weekday: null, weekend: null, holiday: null };
  for (const row of rows) rates[row.day_type] = row;
  return rates;
}

// Saves the place's rate for a day type, replacing the one already saved.
async function saveRate(db, placeId, dayType, rate) {
  assertPlaceRate(dayType, rate);
  if (!(await base.get(db, placeId))) throw new Error('This place no longer exists.');
  const fields = feeFields(rate);
  const current = await db.getFirstAsync(
    'SELECT id FROM place_rate WHERE place_id = ? AND day_type = ? AND deleted_at IS NULL',
    [placeId, dayType]
  );
  if (!current) return placeRates.create(db, { place_id: placeId, day_type: dayType, ...fields });
  await placeRates.update(db, current.id, fields);
  return current.id;
}

// Returns the number of rates removed (0 if none was saved).
async function removeRate(db, placeId, dayType) {
  const current = await db.getFirstAsync(
    'SELECT id FROM place_rate WHERE place_id = ? AND day_type = ? AND deleted_at IS NULL',
    [placeId, dayType]
  );
  return current ? softDeleteRow(db, 'place_rate', current.id) : 0;
}

export const places = {
  ...base,
  findByName,
  getRates,
  saveRate,
  removeRate,

  // Places whose name contains query (any case), recently used first, then
  // never-used ones by name.
  search(db, query = '', { limit = 20 } = {}) {
    return db.getAllAsync(
      `SELECT * FROM place
       WHERE deleted_at IS NULL AND name LIKE ? ESCAPE '\\'
       ORDER BY last_used_at IS NULL, last_used_at DESC, name COLLATE NOCASE
       LIMIT ?`,
      [`%${escapeLike(String(query ?? '').trim())}%`, limit]
    );
  },

  // Every place with a saved location, for finding the one the car is at.
  listLocated(db) {
    return db.getAllAsync(
      'SELECT id, name, lat, lng FROM place WHERE deleted_at IS NULL AND lat IS NOT NULL AND lng IS NOT NULL'
    );
  },

  // Every place by name, with how many sessions were parked there.
  listWithVisits(db) {
    return db.getAllAsync(
      `SELECT p.*,
         (SELECT COUNT(*) FROM parking_session s WHERE s.place_id = p.id AND s.deleted_at IS NULL) AS visits
       FROM place p
       WHERE p.deleted_at IS NULL
       ORDER BY p.name COLLATE NOCASE`
    );
  },

  // The Places edit screen's save: renames the place (name left out keeps
  // its name) and, for each day type in rates, saves a rate or removes it
  // (null). Day types left out keep their rate. All or nothing.
  async saveDetails(db, id, { name, rates = {} }) {
    const trimmed = name === undefined ? undefined : String(name ?? '').trim();
    if (trimmed === '') throw new Error('Give the place a name.');
    const changes = Object.entries(rates);
    for (const [dayType, rate] of changes) {
      if (rate) assertPlaceRate(dayType, rate);
      else if (!DAY_TYPES.includes(dayType)) throw new Error(`Unknown day type: ${dayType}`);
    }
    await inTransaction(db, async (txn) => {
      const place = await base.get(txn, id);
      if (!place) throw new Error('This place no longer exists.');
      if (trimmed !== undefined) {
        const other = await findByName(txn, trimmed);
        if (other && other.id !== id) throw new Error(`You already have a place called ${other.name}.`);
        if (trimmed !== place.name) await base.update(txn, id, { name: trimmed });
      }
      for (const [dayType, rate] of changes) {
        if (rate) await saveRate(txn, id, dayType, rate);
        else await removeRate(txn, id, dayType);
      }
    });
  },

  // Soft-deletes the place together with its saved rates.
  async remove(db, id) {
    let changed = 0;
    await inTransaction(db, async (txn) => {
      const t = now();
      await txn.runAsync(
        'UPDATE place_rate SET deleted_at = ?, updated_at = MAX(?, updated_at + 1), dirty = 1 WHERE place_id = ? AND deleted_at IS NULL',
        [t, t, id]
      );
      changed = await softDeleteRow(txn, 'place', id);
    });
    return changed;
  },
};
