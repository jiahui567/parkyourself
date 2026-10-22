import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as Sharing from 'expo-sharing';

import { newId, now } from './core';

// Kept photos live in the app's own storage, which the system never clears.
const PHOTO_DIR = 'photos';
// Wide enough for OCR to read a pillar sign, small enough to keep many
// (PLAN.md, "OCR for the pillar sign").
const MAX_WIDTH = 1280;

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

// Shrinks a camera picture ({ uri }) to at most MAX_WIDTH wide, saved as a
// JPEG in the cache, and deletes the camera's full-size file, even when
// shrinking fails. Returns the new file's uri. Nothing is kept until savingPhotos.
export async function preparePhoto({ uri }) {
  let context = null;
  try {
    // Decoded straight to the smaller size, so the full-size picture (tens
    // of MB as a bitmap) is never held in memory.
    context = ImageManipulator.manipulate(uri, { maxWidth: MAX_WIDTH });
    const image = await context.renderAsync();
    try {
      const saved = await image.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
      return saved.uri;
    } finally {
      image.release();
    }
  } finally {
    context?.release();
    deletePhotoFiles([uri]);
  }
}

// Copies prepared photos into the app's storage and runs save(keptUris),
// which writes their rows. If save fails, the copies are deleted and the
// prepared files stay, so the user can tap Save again; once it succeeds, the
// prepared files are deleted. Returns what save returns.
export async function savingPhotos(uris, save) {
  const kept = [];
  try {
    const dir = new Directory(Paths.document, PHOTO_DIR);
    dir.create({ intermediates: true, idempotent: true });
    for (const uri of uris) {
      const copy = new File(dir, `${newId()}.jpg`);
      await new File(uri).copy(copy);
      kept.push(copy.uri);
    }
    const result = await save(kept);
    deletePhotoFiles(uris);
    return result;
  } catch (e) {
    deletePhotoFiles(kept);
    throw e;
  }
}

// Opens the share sheet with one kept photo, for WhatsApp or any other app.
// The only way a photo leaves the phone, and only when the user taps Share.
export async function sharePhoto(uri) {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this phone.');
  await Sharing.shareAsync(uri, { mimeType: 'image/jpeg', dialogTitle: 'Share photo' });
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

  // Oldest first, so the first photo is the pillar sign OCR reads. Photos saved
  // together share a created_at; rowid keeps the order they were added in.
  listForSession(db, sessionId) {
    return db.getAllAsync('SELECT * FROM photo WHERE session_id = ? ORDER BY created_at, rowid', [sessionId]);
  },

  async remove(db, id) {
    const row = await db.getFirstAsync('SELECT file_uri FROM photo WHERE id = ?', [id]);
    if (!row) return 0;
    await db.runAsync('DELETE FROM photo WHERE id = ?', [id]);
    deletePhotoFiles([row.file_uri]);
    return 1;
  },
};
