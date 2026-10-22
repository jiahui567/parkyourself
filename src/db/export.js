import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { localDateKey } from '../lib/time';
import { now } from './core';

// Settings > Export database (PLAN.md, "Checking the database from your
// laptop"). The copy only leaves the phone through the share sheet the user opens.

const MIME_TYPE = 'application/vnd.sqlite3';

// expo-sqlite gives a plain path; expo-file-system needs a file:// URI.
export const fileUri = (path) => (path.startsWith('file://') ? path : `file://${path}`);

// Copies the open database to file (an expo-file-system File), replacing it,
// and returns file. The self-test copies to its own file, so it never
// replaces or deletes a real export.
export async function copyDatabaseTo(db, file) {
  // In WAL mode recent writes sit in the -wal file until a checkpoint.
  // TRUNCATE moves them all into the main file, the only one copied.
  const { busy } = await db.getFirstAsync('PRAGMA wal_checkpoint(TRUNCATE)');
  if (busy) throw new Error('The database is busy. Try exporting again in a moment.');

  await new File(fileUri(db.databasePath)).copy(file, { overwrite: true });
  return file;
}

// Copies the open database to the cache as park-yourself-YYYY-MM-DD.db (local
// date), replacing an export from earlier the same day, and returns the copy.
export function copyDatabaseToCache(db, nowMs = now()) {
  return copyDatabaseTo(db, new File(Paths.cache, `park-yourself-${localDateKey(nowMs)}.db`));
}

// Opens the share sheet with a fresh copy, for Google Drive, email or another app.
export async function exportDatabase(db) {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this phone, so the database cannot be exported.');
  }
  const copy = await copyDatabaseToCache(db);
  await Sharing.shareAsync(copy.uri, { mimeType: MIME_TYPE, dialogTitle: 'Export database' });
}
