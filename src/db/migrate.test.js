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
