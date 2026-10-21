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

export function openTestDatabase() {
  const sqlite = new DatabaseSync(':memory:');

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

  const db = {
    async execAsync(source) {
      sqlite.exec(source);
    },
    async runAsync(source, ...params) {
      const { changes, lastInsertRowid } = sqlite.prepare(source).run(...bindValues(params));
      return { changes: Number(changes), lastInsertRowId: Number(lastInsertRowid) };
    },
    async getFirstAsync(source, ...params) {
      return plainRow(sqlite.prepare(source).get(...bindValues(params)));
    },
    async getAllAsync(source, ...params) {
      return sqlite.prepare(source).all(...bindValues(params)).map(plainRow);
    },
    withTransactionAsync(task) {
      return inTransaction('BEGIN', task);
    },
    withExclusiveTransactionAsync(task) {
      return inTransaction('BEGIN EXCLUSIVE', () => task(db));
    },
    close() {
      sqlite.close();
    },
  };
  return db;
}

// A fresh in-memory database with the app's schema.
export async function openMigratedTestDatabase() {
  const db = openTestDatabase();
  await migrate(db);
  return db;
}
