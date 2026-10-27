import { inTransaction, now, syncedTable } from './core';

const base = syncedTable('vehicle');

export const vehicles = {
  ...base,

  // Cars in use (not archived), the default first.
  list(db) {
    return db.getAllAsync(
      'SELECT * FROM vehicle WHERE deleted_at IS NULL AND archived = 0 ORDER BY is_default DESC, name COLLATE NOCASE'
    );
  },

  // Adds a car. The first car in use becomes the default.
  async add(db, { name, colour = null }) {
    const trimmed = String(name ?? '').trim();
    if (!trimmed) throw new Error('Give the car a name');
    let id;
    await inTransaction(db, async (txn) => {
      const { n } = await txn.getFirstAsync(
        'SELECT COUNT(*) AS n FROM vehicle WHERE deleted_at IS NULL AND archived = 0'
      );
      id = await base.create(txn, { name: trimmed, colour, is_default: n === 0 });
    });
    return id;
  },

  // Renames a car, with the same rule as add. Its sessions show the new name.
  async rename(db, id, name) {
    const trimmed = String(name ?? '').trim();
    if (!trimmed) throw new Error('Give the car a name');
    const changed = await base.update(db, id, { name: trimmed });
    if (changed === 0) throw new Error(`No car with id ${id}`);
  },

  async setDefault(db, id) {
    await inTransaction(db, async (txn) => {
      const changed = await base.update(txn, id, { is_default: true });
      if (changed === 0) throw new Error(`No car with id ${id}`);
      await txn.runAsync(
        'UPDATE vehicle SET is_default = 0, updated_at = ?, dirty = 1 WHERE is_default = 1 AND id <> ? AND deleted_at IS NULL',
        [now(), id]
      );
    });
  },

  // Hides a car but keeps its history. A parked car cannot be archived. If it
  // was the default, the next car in use becomes the default.
  async archive(db, id) {
    await inTransaction(db, async (txn) => {
      const parked = await txn.getFirstAsync(
        "SELECT id FROM parking_session WHERE vehicle_id = ? AND status = 'active' AND deleted_at IS NULL",
        [id]
      );
      if (parked) throw new Error('This car is parked. Tap "Found my car" before archiving it.');
      const car = await base.get(txn, id);
      if (!car) throw new Error(`No car with id ${id}`);
      await base.update(txn, id, { archived: true, is_default: false });
      if (!car.is_default) return;
      const next = await txn.getFirstAsync(
        'SELECT id FROM vehicle WHERE deleted_at IS NULL AND archived = 0 ORDER BY created_at LIMIT 1'
      );
      if (next) await base.update(txn, next.id, { is_default: true });
    });
  },
};
