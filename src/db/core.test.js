import { openMigratedTestDatabase } from '../../test/testDatabase';
import { inTransaction } from './core';
import { BUSY_TIMEOUT_MS } from './migrate';
import { settings } from './settings';

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
