import { openMigratedTestDatabase } from '../../test/testDatabase';
import { MAX_LENGTH } from '../lib/textLimits';
import { inTransaction, updateRow } from './core';
import { holidays } from './holidays';
import { BUSY_TIMEOUT_MS } from './migrate';
import { places } from './places';
import { sessions } from './sessions';
import { settings } from './settings';
import { vehicles } from './vehicles';

// inTransaction swaps expo-sqlite's BEGIN for BEGIN IMMEDIATE inside the
// transaction. Node's SQLite has one connection, so how two connections wait
// for each other is checked on the phone (Database check); these check that
// the swap keeps what a transaction promises.

let db;
beforeEach(async () => {
  db = await openMigratedTestDatabase();
});
afterEach(() => db.close());

describe('inTransaction', () => {
  it('keeps every write when the task succeeds', async () => {
    await inTransaction(db, async (txn) => {
      await settings.set(txn, 'a', '1');
      await settings.set(txn, 'b', '2');
    });

    expect([await settings.get(db, 'a'), await settings.get(db, 'b')]).toEqual(['1', '2']);
  });

  it('undoes every write when the task fails, and passes on its error', async () => {
    await expect(
      inTransaction(db, async (txn) => {
        await settings.set(txn, 'a', '1');
        throw new Error('Give the car a name');
      })
    ).rejects.toThrow('Give the car a name');

    expect(await settings.get(db, 'a')).toBeNull();
  });

  it('gives its own connection the wait for the write lock', async () => {
    await db.execAsync('PRAGMA busy_timeout = 0');
    let timeout;
    await inTransaction(db, async (txn) => {
      timeout = (await txn.getFirstAsync('PRAGMA busy_timeout')).timeout;
    });

    expect(timeout).toBe(BUSY_TIMEOUT_MS);
  });
});

// The lengths are the server's too (src/lib/textLimits.js), so the phone
// never takes a change the server would refuse.
describe('text limits', () => {
  const long = (n) => 'x'.repeat(n);

  it('takes text up to the limit', async () => {
    const carId = await vehicles.add(db, { name: long(MAX_LENGTH.vehicle.name) });
    const id = await sessions.start(db, {
      vehicle_id: carId,
      level: long(MAX_LENGTH.parking_session.level),
      bay: long(MAX_LENGTH.parking_session.bay),
      landmark: long(MAX_LENGTH.parking_session.landmark),
      note: long(MAX_LENGTH.parking_session.note),
    });

    expect(await sessions.get(db, id)).toMatchObject({ note: long(500), landmark: long(100) });
  });

  it.each([
    ['a car name', (db) => vehicles.add(db, { name: long(101) }), 'A name can be at most 100 characters.'],
    ['a place name', (db) => places.create(db, { name: long(101) }), 'A name can be at most 100 characters.'],
    ['a place note', (db) => places.create(db, { name: 'Pavilion', note: long(501) }), 'A note can be at most 500 characters.'],
    ['a holiday name', (db) => holidays.add(db, { holiday_date: '2026-12-25', name: long(101) }), 'A name can be at most 100 characters.'],
  ])('refuses %s over the limit', async (_, write, message) => {
    await expect(write(db)).rejects.toThrow(message);
  });

  it.each([
    ['level', { level: long(21) }, 'The level can be at most 20 characters.'],
    ['bay', { bay: long(21) }, 'The bay can be at most 20 characters.'],
    ['first shop', { landmark: long(101) }, 'The first shop can be at most 100 characters.'],
    ['note', { note: long(501) }, 'A note can be at most 500 characters.'],
  ])('refuses a parking %s over the limit, and saves nothing', async (_, typed, message) => {
    const carId = await vehicles.add(db, { name: 'My Myvi' });

    await expect(sessions.start(db, { vehicle_id: carId, ...typed })).rejects.toThrow(message);
    expect(await sessions.listActive(db)).toEqual([]);
  });

  // Every limit, through the helper every write of a synced row goes through.
  const LIMITS = Object.entries(MAX_LENGTH).flatMap(([table, columns]) =>
    Object.entries(columns).map(([column, max]) => [table, column, max])
  );
  const rowIn = async (table) => {
    const carId = await vehicles.add(db, { name: 'My Myvi' });
    if (table === 'vehicle') return carId;
    if (table === 'place') return places.create(db, { name: 'Pavilion' });
    if (table === 'public_holiday') return holidays.add(db, { holiday_date: '2026-12-25' });
    return sessions.start(db, { vehicle_id: carId });
  };
  it.each(LIMITS)('%s.%s takes %i characters and refuses one more', async (table, column, max) => {
    const id = await rowIn(table);

    await expect(updateRow(db, table, id, { [column]: long(max + 1) })).rejects.toThrow(/at most|too long/);
    expect(await updateRow(db, table, id, { [column]: long(max) })).toBe(1);
  });

  it('refuses a rename or a place form over the limit', async () => {
    const carId = await vehicles.add(db, { name: 'My Myvi' });
    const placeId = await places.create(db, { name: 'Pavilion' });

    await expect(vehicles.rename(db, carId, long(101))).rejects.toThrow('A name can be at most 100 characters.');
    await expect(places.saveDetails(db, placeId, { name: long(101) })).rejects.toThrow('A name can be at most 100');
    expect((await vehicles.get(db, carId)).name).toBe('My Myvi');
    expect((await places.get(db, placeId)).name).toBe('Pavilion');
  });

  it('refuses a change over the limit too, and keeps the row as it was', async () => {
    const carId = await vehicles.add(db, { name: 'My Myvi' });
    const id = await sessions.start(db, { vehicle_id: carId });

    await expect(sessions.setWayBack(db, id, { landmark: long(101) })).rejects.toThrow('The first shop can be');
    expect((await sessions.get(db, id)).landmark).toBeNull();
  });
});
