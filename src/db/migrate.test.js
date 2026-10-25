import { openMigratedTestDatabase, openTestDatabase } from '../../test/testDatabase';
import { migrate } from './migrate';
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
