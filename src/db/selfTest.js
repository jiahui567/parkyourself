import { File, Paths } from 'expo-file-system';
import { defaultDatabaseDirectory, deleteDatabaseAsync, openDatabaseAsync } from 'expo-sqlite';

import { CAR_PARK_LIST } from '../carparks/carParkList';
import { holidayRate } from '../fees';
import { carParks } from './carParks';
import { inTransaction, newId } from './core';
import { copyDatabaseTo, fileUri } from './export';
import { holidays } from './holidays';
import { migrate } from './migrate';
import { MIGRATIONS } from './migrations';
import { deletePhotoFiles, photos, savingPhotos } from './photos';
import { placeRates, places } from './places';
import { syncPull } from './pull';
import { sessions } from './sessions';
import { settings } from './settings';
import { syncRows } from './sync';
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

  // A test database is only left behind when a run was interrupted, and
  // expo-sqlite throws when asked to delete one that is not there.
  if (new File(fileUri(defaultDatabaseDirectory), TEST_DB).exists) await deleteDatabaseAsync(TEST_DB);
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

    // Two writes on two connections at once: the second waits instead of
    // failing with "database is locked" (BUSY_TIMEOUT_MS, inTransaction).
    await check('A write waits for a transaction to finish', async () => {
      let holding = false;
      const transaction = inTransaction(db, async (txn) => {
        await txn.runAsync("INSERT OR REPLACE INTO setting (key, value) VALUES ('selftest_lock', 'transaction')");
        holding = true;
        await pause(300);
      });
      // At most 2 s; a transaction that fails before it holds the lock ends
      // the wait with its own error, which is then this check's result.
      for (let tries = 0; !holding && tries < 200; tries++) await Promise.race([pause(10), transaction]);
      assert(holding, 'the transaction never took the write lock');
      const startedAt = Date.now();
      await settings.set(db, 'selftest_lock', 'main');
      const waitedMs = Date.now() - startedAt;
      await transaction;
      const value = await settings.get(db, 'selftest_lock');
      assert(value === 'main', `the write ran before the transaction ended (${value})`);
      assert(waitedMs >= 200, `the write did not wait for the transaction (${waitedMs} ms)`);
      return `waited ${waitedMs} ms`;
    });

    await check('Two transactions that read, then write, both go through', async () => {
      await settings.set(db, 'selftest_count', '0');
      const addOne = () =>
        inTransaction(db, async (txn) => {
          const { value } = await txn.getFirstAsync("SELECT value FROM setting WHERE key = 'selftest_count'");
          await pause(100);
          await txn.runAsync("UPDATE setting SET value = ? WHERE key = 'selftest_count'", [String(Number(value) + 1)]);
        });
      await Promise.all([addOne(), addOne()]);
      const count = await settings.get(db, 'selftest_count');
      assert(count === '2', `count is ${count}: one transaction lost the other's write`);
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

    await check('A change waits for the sync until pushed', async () => {
      assert((await vehicles.get(db, vehicleId)).dirty === 1, 'a new or changed row is not dirty');
      await syncRows.markPushed(db, 'vehicle', await syncRows.listDirty(db, 'vehicle'));
      assert((await vehicles.get(db, vehicleId)).dirty === 0, 'a pushed row is still dirty');
      await pause(5);
      await vehicles.update(db, vehicleId, { colour: 'Red' });
      assert((await vehicles.get(db, vehicleId)).dirty === 1, 'a change after the push is not dirty');
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

    await check('Keeping photos copies them out of the cache', async () => {
      const prepared = new File(Paths.cache, 'selftest-prepared.jpg');
      prepared.create({ overwrite: true });
      prepared.writeSync('not really a photo');
      const kept = await savingPhotos([prepared.uri], async (uris) => uris);
      const copy = new File(kept[0]);
      try {
        assert(copy.exists && copy.size > 0, `kept copy at ${copy.uri} is missing or empty`);
        assert(!copy.uri.startsWith(Paths.cache.uri), 'the kept copy is still in the cache');
        assert(!new File(prepared.uri).exists, 'the prepared file was not deleted');
      } finally {
        deletePhotoFiles(kept);
      }
    });

    await check('A failed save deletes the kept photo copies', async () => {
      const prepared = new File(Paths.cache, 'selftest-prepared.jpg');
      prepared.create({ overwrite: true });
      prepared.writeSync('not really a photo');
      let kept = [];
      await expectRejected(
        savingPhotos([prepared.uri], async (uris) => {
          kept = uris;
          throw new Error('save failed');
        }),
        /save failed/
      );
      try {
        assert(kept.length === 1 && !new File(kept[0]).exists, 'the kept copy was left behind');
        assert(new File(prepared.uri).exists, 'the prepared file should stay for another try');
      } finally {
        deletePhotoFiles([prepared.uri]);
      }
    });

    // sessions.start and sessions.end write several tables in one exclusive
    // transaction, which expo-sqlite runs on a second connection.
    const hourly = {
      type: 'hourly',
      first_minutes: 60,
      first_sen: 300,
      block_minutes: 60,
      block_sen: 200,
      grace_minutes: 15,
      daily_cap_sen: 2000,
    };
    const parkAtMall = (vehicle_id) =>
      sessions.start(db, {
        vehicle_id,
        place_name: 'Self-test Mall',
        rates: { weekday: hourly, holiday: holidayRate(800) },
        save_rates: ['weekday', 'holiday'],
        public_holiday: true,
        started_at: new Date(2026, 9, 27, 10, 0).getTime(),
      });

    await check('Failed parking leaves no place, rate or holiday', async () => {
      const result = await expectRejected(parkAtMall('no-such-vehicle'), /FOREIGN KEY/i);
      assert((await places.findByName(db, 'Self-test Mall')) === null, 'place was kept');
      assert((await holidays.dateSet(db)).size === 0, 'holiday was kept');
      return result;
    });

    const parkedId = await vehicles.create(db, { name: 'Test Bezza' });
    let sessionId;

    await check('Parking saves place, rates, holiday and session together', async () => {
      sessionId = await parkAtMall(parkedId);
      const place = await places.findByName(db, 'Self-test Mall');
      assert(place, 'place not created');
      const rates = await places.getRates(db, place.id);
      assert(rates.weekday && rates.holiday && !rates.weekend, 'rates not saved');
      assert((await holidays.dateSet(db)).has('2026-10-27'), 'holiday not added');
      const session = await sessions.get(db, sessionId);
      assert(session.place_id === place.id, 'session not linked to the place');
      assert(session.rate_snapshot?.includes('"holiday"'), `rate_snapshot is ${session.rate_snapshot}`);
    });

    await check('Ending a session stores the fee', async () => {
      // A public holiday with an RM 8.00 amount saved, so 5 hours is RM 8.00.
      const ended = await sessions.end(db, sessionId, { ended_at: new Date(2026, 9, 27, 15, 0).getTime() });
      const row = await sessions.get(db, sessionId);
      assert(ended.fee_sen === 800 && row.fee_sen === 800, `fee_sen is ${row.fee_sen}`);
      assert(row.status === 'ended' && row.paid_sen === null, 'session not ended as expected');
    });

    // The plain databasePath to file:// URI step only shows on the phone. Its
    // own file name, so a real export made today is neither replaced nor deleted.
    await check('Export copies the database file', async () => {
      const copy = await copyDatabaseTo(db, new File(Paths.cache, 'park-yourself-selftest-export.db'));
      try {
        assert(copy.exists && copy.size > 0, `copy at ${copy.uri} is missing or empty`);
      } finally {
        if (copy.exists) copy.delete();
      }
    });

    // The refresh runs in the phone driver's exclusive transaction, which Jest only imitates.
    await check('Car park list stores every car park and rate', async () => {
      await carParks.refresh(db, CAR_PARK_LIST, 'bundled');
      const { n } = await db.getFirstAsync('SELECT COUNT(*) AS n FROM car_park');
      const { r } = await db.getFirstAsync('SELECT COUNT(*) AS r FROM car_park_rate');
      const expectedRates = CAR_PARK_LIST.carParks.reduce((sum, c) => sum + c.rates.length, 0);
      assert(n === CAR_PARK_LIST.carParks.length, `${n} car parks, expected ${CAR_PARK_LIST.carParks.length}`);
      assert(r === expectedRates, `${r} rates, expected ${expectedRates}`);
      return `${n} car parks, ${r} rates`;
    });

    // Leaving out unknown car parks and dropping reports with their car park
    // both rest on the phone driver's foreign keys and transaction (C10).
    await check('Rate reports follow the car park list', async () => {
      const listed = CAR_PARK_LIST.carParks[0].id;
      const rates = { weekday: { type: 'flat', flat_sen: 300, grace_minutes: 0 }, weekend: null, holiday: null };
      await carParks.replaceReports(db, [
        { id: 'selftest-1', car_park_id: listed, rates, reported_at: 1 },
        { id: 'selftest-2', car_park_id: 'not-on-the-list', rates, reported_at: 2 },
      ]);
      const stored = await carParks.pendingReports(db, listed);
      assert(stored.length === 1 && stored[0].rates.weekday.flat_sen === 300, `${stored.length} reports stored`);
      await carParks.refresh(db, { ...CAR_PARK_LIST, version: 'selftest' }, 'bundled');
      const { n } = await db.getFirstAsync('SELECT COUNT(*) AS n FROM car_park_report');
      assert(n === 0, `${n} reports left after the list was replaced`);
    });

    await check('Settings upsert', async () => {
      await settings.set(db, 'reminder_lead_minutes', '10');
      await settings.set(db, 'reminder_lead_minutes', '15');
      const value = await settings.get(db, 'reminder_lead_minutes');
      assert(value === '15', `got ${value}`);
    });

    // The pull writes with an upsert built from the table's columns, on the
    // transaction connection (C4).
    await check('A pulled row is added, then replaced by a newer one', async () => {
      const pulled = {
        id: newId(),
        name: 'Pulled Myvi',
        colour: null,
        is_default: false,
        archived: false,
        merged_into: null,
        created_at: 1,
        updated_at: 1,
        deleted_at: null,
        server_updated_us: 1,
      };
      await syncPull.apply(db, { vehicle: [pulled] });
      await syncPull.apply(db, { vehicle: [{ ...pulled, name: 'Pulled Axia', updated_at: 2, server_updated_us: 2 }] });
      const stored = await vehicles.get(db, pulled.id);
      assert(stored?.name === 'Pulled Axia' && stored.dirty === 0, `got ${JSON.stringify(stored)}`);
    });
  } catch (e) {
    results.push({ name: 'Self-test setup', ok: false, detail: String(e?.message ?? e) });
  } finally {
    await db.closeAsync();
    await check('Delete the test database', () => deleteDatabaseAsync(TEST_DB));
  }
  return results;
}
