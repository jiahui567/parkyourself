// Read-only facts about the open database, for debug screens.
export async function readDatabaseInfo(db) {
  const { user_version } = await db.getFirstAsync('PRAGMA user_version');
  const { foreign_keys } = await db.getFirstAsync('PRAGMA foreign_keys');
  const { journal_mode } = await db.getFirstAsync('PRAGMA journal_mode');
  const names = await db.getAllAsync(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  );
  const tables = [];
  for (const { name } of names) {
    const { n } = await db.getFirstAsync(`SELECT COUNT(*) AS n FROM "${name}"`);
    tables.push({ name, rows: n });
  }
  return { user_version, foreign_keys, journal_mode, tables };
}
