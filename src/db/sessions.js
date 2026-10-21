import { inTransaction, now, softDeleteRow, syncedTable } from './core';
import { deletePhotoFiles } from './photos';

const base = syncedTable('parking_session');

const ACCESS_TYPES = ['lift', 'escalator', 'stairs', 'other'];

// Empty text is stored as NULL; level and bay are stored in capitals.
const text = (value) => {
  const trimmed = String(value ?? '').trim();
  return trimmed === '' ? null : trimmed;
};
const code = (value) => text(value)?.toUpperCase() ?? null;

// A session with its car and place names.
const DETAILS_SQL = `
  SELECT s.*, v.name AS vehicle_name, p.name AS place_name
  FROM parking_session s
  JOIN vehicle v ON v.id = s.vehicle_id
  LEFT JOIN place p ON p.id = s.place_id AND p.deleted_at IS NULL`;

export const sessions = {
  ...base,

  // Starts parking a car. Throws if the car is already parked.
  async start(db, { vehicle_id, level, bay, zone_colour_name, access_type, landmark, note, started_at = now() }) {
    if (access_type != null && !ACCESS_TYPES.includes(access_type)) {
      throw new Error(`Unknown access type: ${access_type}`);
    }
    let id;
    await inTransaction(db, async (txn) => {
      const parked = await txn.getFirstAsync(
        "SELECT id FROM parking_session WHERE vehicle_id = ? AND status = 'active' AND deleted_at IS NULL",
        [vehicle_id]
      );
      if (parked) throw new Error('This car is already parked. Open it from the home screen.');
      id = await base.create(txn, {
        vehicle_id,
        status: 'active',
        started_at,
        level: code(level),
        bay: code(bay),
        zone_colour_name: text(zone_colour_name),
        access_type: access_type ?? null,
        landmark: text(landmark),
        note: text(note),
      });
    });
    return id;
  },

  // Ends an active session ("Found my car"). The fee columns are filled from M2.
  async end(db, id, { ended_at = now(), fee_sen = null, paid_sen = null } = {}) {
    await inTransaction(db, async (txn) => {
      const row = await txn.getFirstAsync(
        "SELECT started_at FROM parking_session WHERE id = ? AND status = 'active' AND deleted_at IS NULL",
        [id]
      );
      if (!row) throw new Error('This session has already ended.');
      if (ended_at < row.started_at) throw new Error('A session cannot end before it starts.');
      await base.update(txn, id, { status: 'ended', ended_at, fee_sen, paid_sen });
    });
  },

  // Parked cars, newest first, with car names.
  listActive(db) {
    return db.getAllAsync(
      `${DETAILS_SQL} WHERE s.status = 'active' AND s.deleted_at IS NULL ORDER BY s.started_at DESC`
    );
  },

  // Ended sessions, newest first, with car and place names.
  listHistory(db, { limit = 200 } = {}) {
    return db.getAllAsync(
      `${DETAILS_SQL} WHERE s.status = 'ended' AND s.deleted_at IS NULL ORDER BY s.started_at DESC LIMIT ?`,
      [limit]
    );
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
