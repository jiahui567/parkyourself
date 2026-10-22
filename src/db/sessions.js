import { mergeRates, ratesFromSnapshot, savesMissingRate, sessionFee, snapshotText } from '../fees';
import { localDateKey } from '../lib/time';
import { extendTimer } from '../timer/timer';
import { inTransaction, now, softDeleteRow, syncedTable } from './core';
import { holidays } from './holidays';
import { deletePhotoFiles, photos } from './photos';
import { assertPlaceRate, places } from './places';
import { preferences } from './preferences';

const base = syncedTable('parking_session');

const ACCESS_TYPES = ['lift', 'escalator', 'stairs', 'other'];

// Empty text is stored as NULL; level and bay are stored in capitals.
const text = (value) => {
  const trimmed = String(value ?? '').trim();
  return trimmed === '' ? null : trimmed;
};
const code = (value) => text(value)?.toUpperCase() ?? null;

// A session with its car and place names. The place join keeps deleted
// places, so a past session still shows where it was after the place is gone.
const DETAILS_SQL = `
  SELECT s.*, v.name AS vehicle_name, p.name AS place_name
  FROM parking_session s
  JOIN vehicle v ON v.id = s.vehicle_id
  LEFT JOIN place p ON p.id = s.place_id`;

const ACTIVE_SQL = "SELECT * FROM parking_session WHERE id = ? AND status = 'active' AND deleted_at IS NULL";

function assertAccessType(access_type) {
  if (access_type != null && !ACCESS_TYPES.includes(access_type)) {
    throw new Error(`Unknown access type: ${access_type}`);
  }
}

// Rates typed by the user, checked before any write. Returns the day types
// that have a rate.
function checkRates(rates) {
  for (const [dayType, rate] of Object.entries(rates ?? {})) {
    if (rate) assertPlaceRate(dayType, rate);
  }
  return mergeRates(null, rates);
}

export const sessions = {
  ...base,

  // Starts parking a car. Throws if the car is already parked. With a
  // place_name, the place is found (any case) or created; save_rates lists the
  // day types in rates to save to it. rate_snapshot holds the place's saved
  // rates with the ones in rates replacing them, even those not saved
  // ("Only this time"). public_holiday adds the parking day to the holiday list.
  // photo_files ([{ file_uri, ocr_text }]) are kept files (savingPhotos), the
  // pillar sign first, with the text OCR read from each (null when not read).
  async start(
    db,
    {
      vehicle_id,
      level,
      bay,
      zone_colour_name,
      access_type,
      landmark,
      note,
      started_at = now(),
      place_name = null,
      rates = null,
      save_rates = [],
      public_holiday = false,
      timer_ends_at = null,
      photo_files = [],
    }
  ) {
    assertAccessType(access_type);
    const placeName = text(place_name);
    const entered = checkRates(rates);
    for (const dayType of save_rates) {
      if (!entered[dayType]) throw new Error(`No ${dayType} rate to save`);
      if (!placeName) throw new Error('Pick a place to save the rate to.');
    }
    if (timer_ends_at != null && !(timer_ends_at > started_at)) {
      throw new Error('The timer must end after you park.');
    }
    let id;
    await inTransaction(db, async (txn) => {
      const parked = await txn.getFirstAsync(
        "SELECT id FROM parking_session WHERE vehicle_id = ? AND status = 'active' AND deleted_at IS NULL",
        [vehicle_id]
      );
      if (parked) throw new Error('This car is already parked. Open it from the home screen.');

      let place_id = null;
      let rate_snapshot = snapshotText(entered);
      if (placeName) {
        const place = await places.findByName(txn, placeName);
        if (place) {
          place_id = place.id;
          await places.update(txn, place_id, { last_used_at: started_at });
        } else {
          place_id = await places.create(txn, { name: placeName, last_used_at: started_at });
        }
        for (const dayType of save_rates) await places.saveRate(txn, place_id, dayType, entered[dayType]);
        rate_snapshot = snapshotText(mergeRates(await places.getRates(txn, place_id), entered));
      }
      if (public_holiday) await holidays.add(txn, { holiday_date: localDateKey(started_at) });

      id = await base.create(txn, {
        vehicle_id,
        place_id,
        status: 'active',
        started_at,
        level: code(level),
        bay: code(bay),
        zone_colour_name: text(zone_colour_name),
        access_type: access_type ?? null,
        landmark: text(landmark),
        note: text(note),
        rate_snapshot,
        timer_ends_at,
      });
      for (const { file_uri, ocr_text = null } of photo_files) {
        await photos.add(txn, { session_id: id, file_uri, ocr_text });
      }
    });
    return id;
  },

  // Ends an active session ("Found my car") and stores its fee, calculated
  // here from the rate snapshot and the holiday list so it matches the fee
  // shown. missing_rates ({ weekend: rate }) are rates the stay needed but the
  // snapshot lacked: they join the snapshot, and are saved to the place when
  // it has no rate for that day type yet. Returns { fee_sen, paid_sen }.
  async end(db, id, { ended_at = now(), paid_sen = null, missing_rates = null } = {}) {
    if (paid_sen != null && !(Number.isInteger(paid_sen) && paid_sen >= 0)) {
      throw new Error('Enter the amount paid, such as 3.00.');
    }
    const extra = checkRates(missing_rates);
    let stored;
    await inTransaction(db, async (txn) => {
      const session = await txn.getFirstAsync(ACTIVE_SQL, [id]);
      if (!session) throw new Error('This session has already ended.');
      if (ended_at < session.started_at) throw new Error('A session cannot end before it starts.');

      let { rate_snapshot } = session;
      if (Object.keys(extra).length > 0) {
        // The place may have been deleted while the car was parked; the rate
        // is still used for this stay.
        const place = session.place_id ? await places.get(txn, session.place_id) : null;
        if (place) {
          // The same rule as the summary's "saved to the place" hint.
          const placeRates = await places.getRates(txn, place.id);
          for (const [dayType, rate] of Object.entries(extra)) {
            if (savesMissingRate(placeRates, dayType)) await places.saveRate(txn, place.id, dayType, rate);
          }
        }
        rate_snapshot = snapshotText(mergeRates(ratesFromSnapshot(rate_snapshot), extra));
      }

      const fee = sessionFee({ ...session, rate_snapshot }, ended_at, await holidays.dateSet(txn));
      const fee_sen = fee?.feeSen ?? null;
      // The amount paid is kept only when it differs from the fee, so spending
      // can add paid_sen ?? fee_sen. With no fee, a typed amount is kept.
      stored = { fee_sen, paid_sen: paid_sen === fee_sen ? null : paid_sen };
      await base.update(txn, id, { status: 'ended', ended_at, rate_snapshot, ...stored });
    });
    return stored;
  },

  // Sets or clears (null) the timer of a parked car.
  async setTimer(db, id, timer_ends_at) {
    await inTransaction(db, async (txn) => {
      const session = await txn.getFirstAsync(ACTIVE_SQL, [id]);
      if (!session) throw new Error('This session has already ended.');
      if (timer_ends_at != null && !(timer_ends_at > session.started_at)) {
        throw new Error('The timer must end after you park.');
      }
      await base.update(txn, id, { timer_ends_at });
    });
  },

  // The way back, added on Find while parked: how the user left the car park
  // and the first shop they saw, which they only know after walking out.
  // Only the fields in changes are written, so the chips and the shop field
  // save on their own without undoing each other.
  async setWayBack(db, id, changes) {
    const update = {};
    if ('access_type' in changes) {
      assertAccessType(changes.access_type);
      update.access_type = changes.access_type ?? null;
    }
    if ('landmark' in changes) update.landmark = text(changes.landmark);
    await inTransaction(db, async (txn) => {
      const session = await txn.getFirstAsync(ACTIVE_SQL, [id]);
      if (!session) throw new Error('This session has already ended.');
      await base.update(txn, id, update);
    });
  },

  // Extend timer, on Find and from a notification: adds the Extend amount
  // from Settings to the later of the timer's end and now, or starts a timer
  // from now. Returns the new end.
  async extend(db, id, nowMs = now()) {
    const { extendMinutes } = await preferences.get(db);
    let timer_ends_at;
    await inTransaction(db, async (txn) => {
      const session = await txn.getFirstAsync(ACTIVE_SQL, [id]);
      if (!session) throw new Error('This session has already ended.');
      timer_ends_at = extendTimer(session.timer_ends_at, nowMs, extendMinutes);
      await base.update(txn, id, { timer_ends_at });
    });
    return timer_ends_at;
  },

  // Parked cars, newest first, with car names.
  listActive(db) {
    return db.getAllAsync(
      `${DETAILS_SQL} WHERE s.status = 'active' AND s.deleted_at IS NULL ORDER BY s.started_at DESC`
    );
  },

  // Ended sessions, newest first, with car and place names. Filters left
  // undefined do not apply; place_id null means sessions with no place;
  // from and to (epoch ms) select started_at in [from, to). History keeps the
  // default limit; limit null returns every row, for a total that must count
  // every session (Spending, the Sessions screen).
  listHistory(db, { limit = 200, vehicle_id, place_id, from, to } = {}) {
    const where = ["s.status = 'ended'", 's.deleted_at IS NULL'];
    const params = [];
    if (vehicle_id != null) {
      where.push('s.vehicle_id = ?');
      params.push(vehicle_id);
    }
    if (place_id === null) where.push('s.place_id IS NULL');
    else if (place_id !== undefined) {
      where.push('s.place_id = ?');
      params.push(place_id);
    }
    if (from != null) {
      where.push('s.started_at >= ?');
      params.push(from);
    }
    if (to != null) {
      where.push('s.started_at < ?');
      params.push(to);
    }
    // SQLite reads a negative LIMIT as no limit.
    return db.getAllAsync(`${DETAILS_SQL} WHERE ${where.join(' AND ')} ORDER BY s.started_at DESC LIMIT ?`, [
      ...params,
      limit ?? -1,
    ]);
  },

  // One session with car and place names, or null if missing or deleted.
  getDetails(db, id) {
    return db.getFirstAsync(`${DETAILS_SQL} WHERE s.id = ? AND s.deleted_at IS NULL`, [id]);
  },

  // Soft-deletes the session. Its photos never sync, so their rows and image
  // files are deleted for real.
  async remove(db, id) {
    let uris = [];
    let changed = 0;
    await inTransaction(db, async (txn) => {
      const rows = await txn.getAllAsync('SELECT file_uri FROM photo WHERE session_id = ?', [id]);
      uris = rows.map((r) => r.file_uri);
      await txn.runAsync('DELETE FROM photo WHERE session_id = ?', [id]);
      changed = await softDeleteRow(txn, 'parking_session', id);
    });
    deletePhotoFiles(uris);
    return changed;
  },
};
