import { MIGRATIONS } from './migrations';

// Connection settings. Run on every connection the app opens, outside any
// transaction (SQLite ignores PRAGMA foreign_keys inside one).
export async function configureConnection(db) {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
}

// Brings the database up to MIGRATIONS.length. Each step and its user_version
// bump share one transaction, so a failed step leaves the previous version intact.
export async function migrate(db) {
  await configureConnection(db);

  const { user_version: current } = await db.getFirstAsync('PRAGMA user_version');
  if (current > MIGRATIONS.length) {
    throw new Error(
      `Database is at schema v${current}, but this app only knows v${MIGRATIONS.length}. ` +
        'Install the newer app version instead of downgrading.'
    );
  }

  for (let v = current; v < MIGRATIONS.length; v++) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATIONS[v]);
      await db.execAsync(`PRAGMA user_version = ${v + 1}`);
    });
  }
}
