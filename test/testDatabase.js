import { AsyncLocalStorage } from 'node:async_hooks';
import { DatabaseSync } from 'node:sqlite';

import { migrate } from '../src/db/migrate';

// Runs the app's src/db code in Jest on Node's built-in SQLite. It implements
// the part of expo-sqlite's SQLiteDatabase API the data layer uses. On the
// phone, src/db/selfTest.js still checks what only the real driver can show
// (WAL mode, the second connection used by withExclusiveTransactionAsync).

// expo-sqlite takes bind values as one array or as separate arguments.
const bindValues = (params) => (params.length === 1 && Array.isArray(params[0]) ? params[0] : params);

// Node returns rows with a null prototype; expo-sqlite returns plain objects.
const plainRow = (row) => (row ? { ...row } : null);

// On the phone a transaction's task gets txn, a second connection: a read on
// db there misses what the task wrote, and a write waits for txn's lock and
// fails after BUSY_TIMEOUT_MS. Here both use one connection, so these make
// the mistakes fail at once: a query on db made by the task, and an
// inTransaction inside another.
const USED_DB_TEXT =
  'A query inside inTransaction used db, not txn: on the phone a read misses what the task wrote, and a write fails with "database is locked".';
const NESTED_TEXT = 'inTransaction inside inTransaction: on the phone the inner one waits for the outer one and fails.';

export function openTestDatabase() {
  const sqlite = new DatabaseSync(':memory:');
  // The transaction whose task is running, in that task's async calls only:
  // work the task leaves behind (a timer) runs once it is no longer open.
  const runningTask = new AsyncLocalStorage();
  const insideTask = () => runningTask.getStore()?.open === true;

  async function inTransaction(begin, run) {
    sqlite.exec(begin);
    try {
      await run();
      sqlite.exec('COMMIT');
    } catch (e) {
      sqlite.exec('ROLLBACK');
      throw e;
    }
  }

  // The queries, on db (guarded) or on txn.
  const queries = (guard) => ({
    async execAsync(source) {
      guard();
      sqlite.exec(source);
    },
    async runAsync(source, ...params) {
      guard();
      const { changes, lastInsertRowid } = sqlite.prepare(source).run(...bindValues(params));
      return { changes: Number(changes), lastInsertRowId: Number(lastInsertRowid) };
    },
    async getFirstAsync(source, ...params) {
      guard();
      return plainRow(sqlite.prepare(source).get(...bindValues(params)));
    },
    async getAllAsync(source, ...params) {
      guard();
      return sqlite.prepare(source).all(...bindValues(params)).map(plainRow);
    },
  });
  const notInsideTask = () => {
    if (insideTask()) throw new Error(USED_DB_TEXT);
  };

  const txn = {
    ...queries(() => {}),
    withExclusiveTransactionAsync() {
      return Promise.reject(new Error(NESTED_TEXT));
    },
  };
  const db = {
    ...queries(notInsideTask),
    withTransactionAsync(task) {
      return inTransaction('BEGIN', task);
    },
    async withExclusiveTransactionAsync(task) {
      if (insideTask()) throw new Error(NESTED_TEXT);
      const transaction = { open: true };
      try {
        await inTransaction('BEGIN EXCLUSIVE', () => runningTask.run(transaction, () => task(txn)));
      } finally {
        transaction.open = false;
      }
    },
    close() {
      sqlite.close();
    },
  };
  // As expo-sqlite's transaction connection, the path of db's file.
  Object.defineProperty(txn, 'databasePath', { get: () => db.databasePath });
  return db;
}

// A fresh in-memory database with the app's schema.
export async function openMigratedTestDatabase() {
  const db = openTestDatabase();
  await migrate(db);
  return db;
}
