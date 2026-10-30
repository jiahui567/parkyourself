import { inTransaction } from '../src/db/core';
import { openMigratedTestDatabase } from './testDatabase';

// The Jest database makes the transaction mistakes fail that fail on the
// phone (AGENTS.md, "Data"), so a test catches them.
let db;
beforeEach(async () => {
  db = await openMigratedTestDatabase();
});
afterEach(() => db.close());

it('fails a query that the task sends to db instead of txn, and keeps nothing', async () => {
  await expect(
    inTransaction(db, async (txn) => {
      await txn.runAsync("INSERT INTO setting (key, value) VALUES ('a', '1')");
      await db.getFirstAsync('SELECT 1');
    })
  ).rejects.toThrow('used db, not txn');

  expect(await db.getFirstAsync("SELECT value FROM setting WHERE key = 'a'")).toBeNull();
});

it('fails an inTransaction inside another', async () => {
  await expect(inTransaction(db, (txn) => inTransaction(txn, async () => {}))).rejects.toThrow(
    'inTransaction inside inTransaction'
  );
});

it('lets db work again once the transaction has ended, also for work the task left behind', async () => {
  let later;
  await inTransaction(db, async (txn) => {
    await txn.runAsync("INSERT INTO setting (key, value) VALUES ('a', '1')");
    later = new Promise((resolve) => setTimeout(resolve, 0)).then(() =>
      db.getFirstAsync("SELECT value FROM setting WHERE key = 'a'")
    );
  });

  expect(await later).toEqual({ value: '1' });
});
