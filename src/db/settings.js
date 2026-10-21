// Local-only key/value preferences for this phone. Values are stored as text.
export const settings = {
  async get(db, key) {
    const row = await db.getFirstAsync('SELECT value FROM setting WHERE key = ?', [key]);
    return row ? row.value : null;
  },

  set(db, key, value) {
    return db.runAsync(
      'INSERT INTO setting (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      [key, value]
    );
  },
};
