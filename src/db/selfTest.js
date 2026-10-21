import { File, Paths } from 'expo-file-system';
import { deleteDatabaseAsync, openDatabaseAsync } from 'expo-sqlite';

import { inTransaction } from './core';
import { migrate } from './migrate';
import { MIGRATIONS } from './migrations';
import { photos } from './photos';
import { placeRates, places } from './places';
import { sessions } from './sessions';
import { settings } from './settings';
import { vehicles } from './vehicles';

const TEST_DB = 'park-yourself-selftest.db';
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function expectRejected(promise, pattern) {
  try {
    await promise;
  } catch (e) {
    const message = String(e?.message ?? e);
    if (pattern.test(message)) return `rejected (${pattern.source})`;
    throw new Error(`rejected with an unexpected error: ${message}`);
  }
  throw new Error('expected the write to be rejected, but it succeeded');
}

// Checks the schema and the data layer rules on the device, using a throwaway
// database so the real one never gets test rows. Returns [{ name, ok, detail }].
export async function runSelfTest() {
  const results = [];
  const check = async (name, fn) => {
    try {
      results.push({ name, ok: true, detail: (await fn()) ?? '' });
    } catch (e) {
      results.push({ name, ok: false, detail: String(e?.message ?? e) });
    }
  };

  await deleteDatabaseAsync(TEST_DB).catch(() => {});
  const db = await openDatabaseAsync(TEST_DB);
  try {
    await migrate(db);

    await check('Schema version', async () => {
      const { user_version } = await db.getFirstAsync('PRAGMA user_version');
      assert(user_version === MIGRATIONS.length, `user_version is ${user_version}`);
      return `v${user_version}`;
    });

    await check('Foreign keys on (main connection)', async () => {
      const { foreign_keys } = await db.getFirstAsync('PRAGMA foreign_keys');
      assert(foreign_keys === 1, `foreign_keys is ${foreign_keys}`);
    });

    await check('Foreign keys on (transaction connection)', async () => {
      let value;
      await inTransaction(db, async (txn) => {
        value = (await txn.getFirstAsync('PRAGMA foreign_keys')).foreign_keys;
      });
      assert(value === 1, `foreign_keys is ${value}; is the SQLITE_DEFAULT_FOREIGN_KEYS build flag set?`);
    });

    await check('WAL journal mode', async () => {
      const { journal_mode } = await db.getFirstAsync('PRAGMA journal_mode');
      assert(journal_mode === 'wal', `journal_mode is ${journal_mode}`);
    });

    const vehicleId = await vehicles.create(db, { name: 'Test Myvi', is_default: true });

    await check('Insert sets UUID id and timestamps', async () => {
      const row = await vehicles.get(db, vehicleId);
      assert(UUID_V4.test(row.id), `id ${row.id} is not a UUID v4`);
      assert(row.created_at > 0 && row.created_at === row.updated_at, 'created_at/updated_at not set');
      assert(row.deleted_at === null, 'deleted_at should be null');
      assert(row.is_default === 1, `is_default stored as ${row.is_default}`);
      return row.id;
    });

    await check('Update bumps updated_at', async () => {
      await pause(5);
      const changed = await vehicles.update(db, vehicleId, { name: 'Test Axia' });
      const row = await vehicles.get(db, vehicleId);
      assert(changed === 1 && row.name === 'Test Axia', 'name not updated');
      assert(row.updated_at > row.created_at, 'updated_at not bumped');
    });

    await check('Foreign key rejects unknown vehicle', () =>
      expectRejected(
        sessions.create(db, { vehicle_id: 'no-such-vehicle', status: 'active', started_at: Date.now() }),
        /FOREIGN KEY/i
      )
    );

    await check('Only one active session per vehicle', async () => {
      await sessions.create(db, { vehicle_id: vehicleId, status: 'active', started_at: Date.now() });
      return expectRejected(
        sessions.create(db, { vehicle_id: vehicleId, status: 'active', started_at: Date.now() }),
        /UNIQUE/i
      );
    });

    const placeId = await places.create(db, { name: 'Pavilion Bukit Jalil' });

    await check('Place names are unique, ignoring case', () =>
      expectRejected(places.create(db, { name: 'pavilion bukit jalil' }), /UNIQUE/i)
    );

    await check('Public holiday rate must be flat', () =>
      expectRejected(
        placeRates.create(db, { place_id: placeId, day_type: 'holiday', type: 'hourly' }),
        /CHECK/i
      )
    );

    await check('Deleting a place soft-deletes its rates', async () => {
      const rateId = await placeRates.create(db, {
        place_id: placeId,
        day_type: 'weekday',
        type: 'hourly',
        first_minutes: 60,
        first_sen: 300,
        block_minutes: 60,
        block_sen: 200,
      });
      await places.remove(db, placeId);
      assert((await places.get(db, placeId)) === null, 'deleted place still readable');
      assert((await placeRates.get(db, rateId)) === null, 'rate still readable');
      const raw = await db.getFirstAsync('SELECT deleted_at FROM place_rate WHERE id = ?', [rateId]);
      assert(raw && raw.deleted_at !== null, 'rate row should remain with deleted_at set');
    });

    await check('Deleted place name can be reused', async () => {
      await places.create(db, { name: 'Pavilion Bukit Jalil' });
    });

    await check('Deleting a session removes its photos for real', async () => {
      const sessionId = await sessions.create(db, {
        vehicle_id: vehicleId,
        status: 'ended',
        started_at: Date.now() - 3600000,
        ended_at: Date.now(),
      });
      const file = new File(Paths.cache, 'selftest-photo.jpg');
      file.create({ overwrite: true });
      file.writeSync('not really a photo');
      await photos.add(db, { session_id: sessionId, file_uri: file.uri, ocr_text: 'B2 C14' });

      await sessions.remove(db, sessionId);
      const session = await db.getFirstAsync('SELECT deleted_at FROM parking_session WHERE id = ?', [
        sessionId,
      ]);
      const { n } = await db.getFirstAsync('SELECT COUNT(*) AS n FROM photo WHERE session_id = ?', [
        sessionId,
      ]);
      assert(session.deleted_at !== null, 'session should be soft-deleted');
      assert(n === 0, `${n} photo rows left`);
      assert(!new File(file.uri).exists, 'image file still on disk');
    });

    await check('Settings upsert', async () => {
      await settings.set(db, 'reminder_lead_minutes', '10');
      await settings.set(db, 'reminder_lead_minutes', '15');
      const value = await settings.get(db, 'reminder_lead_minutes');
      assert(value === '15', `got ${value}`);
    });
  } catch (e) {
    results.push({ name: 'Self-test setup', ok: false, detail: String(e?.message ?? e) });
  } finally {
    await db.closeAsync();
    await deleteDatabaseAsync(TEST_DB).catch(() => {});
  }
  return results;
}
