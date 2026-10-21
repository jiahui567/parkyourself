import { inTransaction, now, softDeleteRow, syncedTable } from './core';

export const placeRates = syncedTable('place_rate');

export const places = {
  ...syncedTable('place'),

  // Soft-deletes the place together with its saved rates.
  async remove(db, id) {
    let changed = 0;
    await inTransaction(db, async (txn) => {
      const t = now();
      await txn.runAsync(
        'UPDATE place_rate SET deleted_at = ?, updated_at = ? WHERE place_id = ? AND deleted_at IS NULL',
        [t, t, id]
      );
      changed = await softDeleteRow(txn, 'place', id);
    });
    return changed;
  },
};
