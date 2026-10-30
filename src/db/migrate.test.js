import { openMigratedTestDatabase, openTestDatabase } from '../../test/testDatabase';
import { MAX_LENGTH } from '../lib/textLimits';
import { BUSY_TIMEOUT_MS, migrate } from './migrate';
import { MIGRATIONS } from './migrations';

// Every database a test opens is closed afterwards so Jest workers exit cleanly.
const opened = [];
const track = (db) => (opened.push(db), db);
afterEach(() => opened.splice(0).forEach((db) => db.close()));

const tableNames = async (db) =>
  (
    await db.getAllAsync(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    )
  ).map((r) => r.name);

describe('migrate', () => {
  it('brings an empty database to the latest schema version', async () => {
    const db = track(await openMigratedTestDatabase());

    expect((await db.getFirstAsync('PRAGMA user_version')).user_version).toBe(MIGRATIONS.length);
    expect(await tableNames(db)).toEqual([
      'car_park',
      'car_park_rate',
      'car_park_report',
      'parking_session',
      'photo',
      'place',
      'place_rate',
      'public_holiday',
      'setting',
      'vehicle',
    ]);
  });

  it('changes nothing when run again on an up-to-date database', async () => {
    const db = track(await openMigratedTestDatabase());
    await db.runAsync("INSERT INTO setting (key, value) VALUES ('probe', 'kept')");

    await migrate(db);

    expect((await db.getFirstAsync('PRAGMA user_version')).user_version).toBe(MIGRATIONS.length);
    expect(await db.getFirstAsync("SELECT value FROM setting WHERE key = 'probe'")).toEqual({ value: 'kept' });
  });

  it('adds the car park list to a v1 database and keeps its places', async () => {
    const db = track(openTestDatabase());
    await db.execAsync(MIGRATIONS[0]);
    await db.execAsync('PRAGMA user_version = 1');
    await db.runAsync(
      "INSERT INTO place (id, name, created_at, updated_at) VALUES ('p1', 'Sunway Pyramid', 1, 1)"
    );

    await migrate(db);

    expect((await db.getFirstAsync('PRAGMA user_version')).user_version).toBe(MIGRATIONS.length);
    expect(await db.getFirstAsync("SELECT name FROM place WHERE id = 'p1'")).toEqual({ name: 'Sunway Pyramid' });
    expect(await db.getFirstAsync('SELECT COUNT(*) AS n FROM car_park')).toEqual({ n: 0 });
  });

  it('empties the v2 car park list for reloading with rate history (v3)', async () => {
    const db = track(openTestDatabase());
    for (let v = 0; v < 2; v++) {
      await db.execAsync(MIGRATIONS[v]);
      await db.execAsync(`PRAGMA user_version = ${v + 1}`);
    }
    await db.runAsync(
      "INSERT INTO car_park (id, name, source_url, checked_on, effective_from) VALUES ('p', 'Pyramid', 'https://x', '2026-10-24', '2025-01-01')"
    );
    await db.runAsync("INSERT INTO car_park_rate (car_park_id, day_type, type, flat_sen) VALUES ('p', 'weekday', 'flat', 300)");
    await db.runAsync("INSERT INTO setting (key, value) VALUES ('car_park_list_version', 'bundled:old#x')");

    await migrate(db);

    expect(await db.getFirstAsync('SELECT COUNT(*) AS n FROM car_park')).toEqual({ n: 0 });
    expect(await db.getFirstAsync("SELECT value FROM setting WHERE key = 'car_park_list_version'")).toBeNull();
    const columns = (await db.getAllAsync('PRAGMA table_info(car_park_rate)')).map((c) => c.name);
    expect(columns).toContain('effective_from');
  });

  it('adds pending rate reports to a v3 database and keeps its car park list (v4)', async () => {
    const db = track(openTestDatabase());
    for (let v = 0; v < 3; v++) {
      await db.execAsync(MIGRATIONS[v]);
      await db.execAsync(`PRAGMA user_version = ${v + 1}`);
    }
    await db.runAsync("INSERT INTO car_park (id, name, source_url, checked_on) VALUES ('p', 'Pyramid', 'https://x', '2026-10-24')");

    await migrate(db);

    expect(await db.getFirstAsync('SELECT name FROM car_park')).toEqual({ name: 'Pyramid' });
    expect(await db.getFirstAsync('SELECT COUNT(*) AS n FROM car_park_report')).toEqual({ n: 0 });
  });

  it('marks every row already on the phone to push at the first sync (v5)', async () => {
    const db = track(openTestDatabase());
    for (let v = 0; v < 4; v++) {
      await db.execAsync(MIGRATIONS[v]);
      await db.execAsync(`PRAGMA user_version = ${v + 1}`);
    }
    await db.runAsync("INSERT INTO vehicle (id, name, created_at, updated_at) VALUES ('v', 'My Myvi', 1, 1)");
    await db.runAsync("INSERT INTO place (id, name, created_at, updated_at, deleted_at) VALUES ('p', 'Mid Valley', 1, 2, 2)");

    await migrate(db);

    expect(await db.getFirstAsync('SELECT name, dirty FROM vehicle')).toEqual({ name: 'My Myvi', dirty: 1 });
    expect(await db.getFirstAsync('SELECT deleted_at, dirty FROM place')).toEqual({ deleted_at: 2, dirty: 1 });
  });

  it('keeps a v5 database\'s rows for the pull: nothing merged, every session parked here (v6)', async () => {
    const db = track(openTestDatabase());
    for (let v = 0; v < 5; v++) {
      await db.execAsync(MIGRATIONS[v]);
      await db.execAsync(`PRAGMA user_version = ${v + 1}`);
    }
    await db.runAsync("INSERT INTO vehicle (id, name, created_at, updated_at, dirty) VALUES ('v', 'My Myvi', 1, 1, 0)");
    await db.runAsync("INSERT INTO place (id, name, created_at, updated_at) VALUES ('p', 'Mid Valley', 1, 1)");
    await db.runAsync(
      "INSERT INTO parking_session (id, vehicle_id, status, started_at, created_at, updated_at) VALUES ('s', 'v', 'active', 1, 1, 1)"
    );

    await migrate(db);

    expect(await db.getFirstAsync('SELECT merged_into, dirty FROM vehicle')).toEqual({ merged_into: null, dirty: 0 });
    expect(await db.getFirstAsync('SELECT merged_into FROM place')).toEqual({ merged_into: null });
    expect(await db.getFirstAsync('SELECT parked_here FROM parking_session')).toEqual({ parked_here: 1 });
  });

  it('adds the History, place and photo indexes to a v6 database and keeps its rows (v7)', async () => {
    const db = track(openTestDatabase());
    for (let v = 0; v < 6; v++) {
      await db.execAsync(MIGRATIONS[v]);
      await db.execAsync(`PRAGMA user_version = ${v + 1}`);
    }
    await db.runAsync("INSERT INTO vehicle (id, name, created_at, updated_at) VALUES ('v', 'My Myvi', 1, 1)");
    await db.runAsync(
      "INSERT INTO parking_session (id, vehicle_id, status, started_at, ended_at, created_at, updated_at) VALUES ('s', 'v', 'ended', 1, 2, 1, 2)"
    );
    await db.runAsync("INSERT INTO photo (id, session_id, file_uri, created_at) VALUES ('f', 's', 'file:///p.jpg', 1)");

    await migrate(db);

    const indexes = await db.getAllAsync("SELECT name FROM sqlite_master WHERE type = 'index' AND name IN (?, ?, ?)", [
      'parking_session_history',
      'parking_session_place',
      'photo_session',
    ]);
    expect(indexes).toHaveLength(3);
    expect(await db.getFirstAsync('SELECT status, parked_here FROM parking_session')).toEqual({
      status: 'ended',
      parked_here: 1,
    });
    expect(await db.getFirstAsync('SELECT file_uri FROM photo')).toEqual({ file_uri: 'file:///p.jpg' });
  });

  describe('v8: text saved before the limits', () => {
    const long = (n, c = 'x') => c.repeat(n);
    async function v7Database() {
      const db = track(openTestDatabase());
      for (let v = 0; v < 7; v++) {
        await db.execAsync(MIGRATIONS[v]);
        await db.execAsync(`PRAGMA user_version = ${v + 1}`);
      }
      await db.runAsync("INSERT INTO vehicle (id, name, created_at, updated_at, dirty) VALUES ('car', 'My Myvi', 1, 5, 0)");
      return db;
    }
    // A row of table with column one character over its limit (src/lib/textLimits.js).
    async function rowOverLimit(db, table, column, max) {
      const id = `${table}-${column}`;
      const value = long(max + 1);
      if (table === 'vehicle') {
        await db.runAsync('INSERT INTO vehicle (id, name, colour, created_at, updated_at, dirty) VALUES (?, ?, ?, 1, 5, 0)', [
          id,
          column === 'name' ? value : 'Axia',
          column === 'colour' ? value : null,
        ]);
      } else if (table === 'place') {
        await db.runAsync('INSERT INTO place (id, name, note, created_at, updated_at, dirty) VALUES (?, ?, ?, 1, 5, 0)', [
          id,
          column === 'name' ? value : `Place ${column}`,
          column === 'note' ? value : null,
        ]);
      } else if (table === 'public_holiday') {
        await db.runAsync(
          "INSERT INTO public_holiday (id, holiday_date, name, created_at, updated_at, dirty) VALUES (?, '2026-12-25', ?, 1, 5, 0)",
          [id, value]
        );
      } else {
        await db.runAsync(
          `INSERT INTO parking_session (id, vehicle_id, status, started_at, ${column}, created_at, updated_at, dirty)
           VALUES (?, 'car', 'ended', 1, ?, 1, 5, 0)`,
          [id, value]
        );
      }
      return id;
    }
    const LIMITS = Object.entries(MAX_LENGTH).flatMap(([table, columns]) =>
      Object.entries(columns)
        .filter(([column]) => column !== 'rate_snapshot')
        .map(([column, max]) => [table, column, max])
    );

    it.each(LIMITS)('cuts %s.%s to %i and pushes it, one later than it was', async (table, column, max) => {
      const db = await v7Database();
      const id = await rowOverLimit(db, table, column, max);

      await migrate(db);

      const row = await db.getFirstAsync(`SELECT ${column} AS value, updated_at, dirty FROM ${table} WHERE id = ?`, [id]);
      expect(row).toMatchObject({ updated_at: 6, dirty: 1 });
      expect(row.value.length).toBeLessThanOrEqual(max);
    });

    it('makes two long place names that share 100 characters two names, and opens', async () => {
      const db = await v7Database();
      const shared = long(100, 'P');
      await db.runAsync(
        "INSERT INTO place (id, name, created_at, updated_at, dirty, deleted_at) VALUES ('1aaaaaaa-0000', ?, 1, 5, 0, NULL), ('2bbbbbbb-0000', ?, 1, 5, 0, NULL)",
        [`${shared} North`, `${shared} South`]
      );

      await migrate(db);

      expect((await db.getAllAsync('SELECT name FROM place ORDER BY id')).map((p) => p.name)).toEqual([
        `${long(91, 'P')} 1aaaaaaa`,
        `${long(91, 'P')} 2bbbbbbb`,
      ]);
    });

    // Names an account chose to clash with a cut (the server skips the same place).
    it('keeps the name of a place whose cut would be another place, and still cuts its note', async () => {
      const db = await v7Database();
      await db.runAsync(
        "INSERT INTO place (id, name, note, created_at, updated_at, dirty) VALUES ('3ccccccc-0000', ?, ?, 1, 5, 0), ('4ddddddd-0000', ?, NULL, 1, 5, 0)",
        [`${long(100, 'P')} North`, long(600), `${long(91, 'P')} 3ccccccc`]
      );

      await migrate(db);

      expect(await db.getAllAsync('SELECT id, length(name) AS name, length(note) AS note, updated_at, dirty FROM place ORDER BY id')).toEqual([
        { id: '3ccccccc-0000', name: 106, note: 500, updated_at: 6, dirty: 1 },
        { id: '4ddddddd-0000', name: 100, note: null, updated_at: 5, dirty: 0 },
      ]);
    });

    it('stamps a row over two limits one later, once, as the server does', async () => {
      const db = await v7Database();
      await db.runAsync("INSERT INTO vehicle (id, name, colour, created_at, updated_at, dirty) VALUES ('b0000000-both', ?, ?, 1, 5, 0)", [
        long(150),
        long(150),
      ]);

      await migrate(db);

      expect(await db.getFirstAsync("SELECT length(name) AS name, length(colour) AS colour, updated_at FROM vehicle WHERE id = 'b0000000-both'")).toEqual({
        name: 100,
        colour: 100,
        updated_at: 6,
      });
    });

    it('trims the spaces a cut leaves at the end, as the app stores text', async () => {
      const db = await v7Database();
      await db.runAsync(
        "INSERT INTO parking_session (id, vehicle_id, status, started_at, landmark, created_at, updated_at, dirty) VALUES ('s', 'car', 'ended', 1, ?, 1, 5, 0)",
        [`${long(99)} and more`]
      );

      await migrate(db);

      expect(await db.getFirstAsync("SELECT landmark FROM parking_session WHERE id = 's'")).toEqual({ landmark: long(99) });
    });

    it('cuts a deleted row too, since its deletion syncs', async () => {
      const db = await v7Database();
      await db.runAsync(
        "INSERT INTO place (id, name, note, created_at, updated_at, dirty, deleted_at) VALUES ('p', 'Mid Valley', ?, 1, 5, 0, 5)",
        [long(600)]
      );

      await migrate(db);

      expect(await db.getFirstAsync('SELECT length(note) AS note, dirty FROM place')).toEqual({ note: 500, dirty: 1 });
    });

    it('clears a zone colour hex that is not #RRGGBB, and leaves rows within the limits alone', async () => {
      const db = await v7Database();
      await db.runAsync(
        `INSERT INTO parking_session (id, vehicle_id, status, started_at, level, zone_colour_hex, created_at, updated_at, dirty)
         VALUES ('bad', 'car', 'ended', 1, 'B2', '#abc', 1, 5, 0), ('fine', 'car', 'ended', 1, 'B2', '#1E5BD8', 1, 5, 0)`
      );

      await migrate(db);

      expect(await db.getAllAsync('SELECT id, zone_colour_hex, updated_at, dirty FROM parking_session ORDER BY id')).toEqual([
        { id: 'bad', zone_colour_hex: null, updated_at: 6, dirty: 1 },
        { id: 'fine', zone_colour_hex: '#1E5BD8', updated_at: 5, dirty: 0 },
      ]);
      expect(await db.getFirstAsync("SELECT updated_at, dirty FROM vehicle WHERE id = 'car'")).toEqual({ updated_at: 5, dirty: 0 });
    });
  });

  it('makes a write wait for another connection instead of failing at once', async () => {
    const db = track(await openMigratedTestDatabase());

    expect(await db.getFirstAsync('PRAGMA busy_timeout')).toEqual({ timeout: BUSY_TIMEOUT_MS });
  });

  it('refuses a database made by a newer app version', async () => {
    const db = track(openTestDatabase());
    await db.execAsync(`PRAGMA user_version = ${MIGRATIONS.length + 1}`);

    await expect(migrate(db)).rejects.toThrow('Install the newer app version');
  });

  it('turns foreign keys on', async () => {
    const db = track(await openMigratedTestDatabase());

    expect((await db.getFirstAsync('PRAGMA foreign_keys')).foreign_keys).toBe(1);
  });
});
