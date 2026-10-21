import { File } from 'expo-file-system';

import { newId, now } from './core';

// Deletes image files after their rows are gone. A leftover file is harmless;
// a row pointing at a missing file is not, so rows always go first.
export function deletePhotoFiles(uris) {
  for (const uri of uris) {
    try {
      const file = new File(uri);
      if (file.exists) file.delete();
    } catch (e) {
      console.warn(`Could not delete photo file ${uri}`, e);
    }
  }
}

// Local-only table: no updated_at or soft delete, rows are deleted for real.
export const photos = {
  async add(db, { session_id, file_uri, ocr_text = null }) {
    const id = newId();
    await db.runAsync(
      'INSERT INTO photo (id, session_id, file_uri, ocr_text, created_at) VALUES (?, ?, ?, ?, ?)',
      [id, session_id, file_uri, ocr_text, now()]
    );
    return id;
  },

  listForSession(db, sessionId) {
    return db.getAllAsync('SELECT * FROM photo WHERE session_id = ? ORDER BY created_at', [
      sessionId,
    ]);
  },

  async remove(db, id) {
    const row = await db.getFirstAsync('SELECT file_uri FROM photo WHERE id = ?', [id]);
    if (!row) return 0;
    await db.runAsync('DELETE FROM photo WHERE id = ?', [id]);
    deletePhotoFiles([row.file_uri]);
    return 1;
  },
};
