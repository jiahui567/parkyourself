import { inTransaction, softDeleteRow, syncedTable } from './core';
import { deletePhotoFiles } from './photos';

export const sessions = {
  ...syncedTable('parking_session'),

  // Soft-deletes the session. Its photos never sync, so their rows and image
  // files are deleted for real.
  async remove(db, id) {
    let uris = [];
    let changed = 0;
    await inTransaction(db, async (txn) => {
      const rows = await txn.getAllAsync('SELECT file_uri FROM photo WHERE session_id = ?', [id]);
      uris = rows.map((r) => r.file_uri);
      await txn.runAsync('DELETE FROM photo WHERE session_id = ?', [id]);
      changed = await softDeleteRow(txn, 'parking_session', id);
    });
    deletePhotoFiles(uris);
    return changed;
  },
};
