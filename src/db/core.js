import * as Crypto from 'expo-crypto';

import { BUSY_TIMEOUT_MS } from './migrate';

// Columns callers may set on each synced table. id, created_at, updated_at and
// deleted_at are managed here. Table and column names cannot be bound as SQL
// parameters, so this list is also what makes them safe to put in SQL text.
const SYNCED_COLUMNS = {
  vehicle: ['name', 'colour', 'is_default', 'archived', 'merged_into'],
  place: ['name', 'note', 'lat', 'lng', 'last_used_at', 'merged_into'],
  place_rate: [
    'place_id', 'day_type', 'type', 'first_minutes', 'first_sen', 'block_minutes',
    'block_sen', 'grace_minutes', 'daily_cap_sen', 'flat_sen',
  ],
  public_holiday: ['holiday_date', 'name'],
  parking_session: [
    'vehicle_id', 'place_id', 'status', 'started_at', 'ended_at', 'level', 'bay',
    'zone_colour_name', 'zone_colour_hex', 'access_type', 'landmark', 'note',
    'rate_snapshot', 'timer_ends_at', 'fee_sen', 'paid_sen', 'lat', 'lng', 'gps_accuracy_m',
  ],
};

export const newId = () => Crypto.randomUUID();
export const now = () => Date.now();

// Told after each write to a synced table, so the sync can follow a few
// seconds later (src/hooks/useSync.js). A write inside a transaction tells
// before it commits; the wait covers that, and after a rollback the sync
// finds nothing new to push.
const changeListeners = new Set();

export function onSyncedChange(listener) {
  changeListeners.add(listener);
  return () => changeListeners.delete(listener);
}

function tellChanged() {
  changeListeners.forEach((listener) => listener());
}

function assertSyncedTable(table) {
  if (!SYNCED_COLUMNS[table]) throw new Error(`Not a synced table: ${table}`);
}

// Validates column names against the allowlist. Undefined fields are skipped
// and booleans are stored as 0/1.
function toEntries(table, values) {
  assertSyncedTable(table);
  const allowed = SYNCED_COLUMNS[table];
  const entries = Object.entries(values).filter(([, v]) => v !== undefined);
  for (const [col] of entries) {
    if (!allowed.includes(col)) throw new Error(`Unknown column ${table}.${col}`);
  }
  return entries.map(([col, v]) => [col, typeof v === 'boolean' ? Number(v) : v]);
}

export async function insertRow(db, table, values) {
  const entries = toEntries(table, values);
  const id = newId();
  const t = now();
  const cols = ['id', ...entries.map(([c]) => c), 'created_at', 'updated_at'];
  const params = [id, ...entries.map(([, v]) => v), t, t];
  // dirty starts at 1 (its column default): a new row waits to be pushed.
  await db.runAsync(
    `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
    params
  );
  tellChanged();
  return id;
}

// Returns the number of rows changed (0 if the row is missing or deleted).
// Every change marks the row dirty, to be pushed by the sync.
export async function updateRow(db, table, id, changes) {
  const entries = toEntries(table, changes);
  const sets = [...entries.map(([c]) => `${c} = ?`), 'updated_at = ?', 'dirty = 1'];
  const result = await db.runAsync(
    `UPDATE ${table} SET ${sets.join(', ')} WHERE id = ? AND deleted_at IS NULL`,
    [...entries.map(([, v]) => v), now(), id]
  );
  if (result.changes) tellChanged();
  return result.changes;
}

// Synced tables are never DELETEd, so the deletion can be synced later.
export async function softDeleteRow(db, table, id) {
  assertSyncedTable(table);
  const t = now();
  const result = await db.runAsync(
    `UPDATE ${table} SET deleted_at = ?, updated_at = ?, dirty = 1 WHERE id = ? AND deleted_at IS NULL`,
    [t, t, id]
  );
  if (result.changes) tellChanged();
  return result.changes;
}

export function getRow(db, table, id) {
  assertSyncedTable(table);
  return db.getFirstAsync(`SELECT * FROM ${table} WHERE id = ? AND deleted_at IS NULL`, [id]);
}

// Runs task(txn) on its own connection so unrelated queries cannot slip into
// the transaction. Every query inside must go through txn, not db.
//
// expo-sqlite opens that connection's transaction with a plain BEGIN, which
// takes the write lock only at the first write and never waits for it: a
// write on another connection at that moment fails the transaction with
// "database is locked", and one committed after the transaction has read
// fails it on a stale snapshot. So it is swapped at once for BEGIN IMMEDIATE,
// which takes the lock before anything is read, waiting up to
// BUSY_TIMEOUT_MS; expo-sqlite's own COMMIT or ROLLBACK then ends it. This
// relies on how expo-sqlite 58 starts the transaction, so run Database check
// on the phone after every expo-sqlite upgrade: its self-test checks it.
// Never nest inTransaction: the inner one would wait for the outer one's lock
// and fail after BUSY_TIMEOUT_MS. Helpers given txn run their queries on it.
export function inTransaction(db, task) {
  return db.withExclusiveTransactionAsync(async (txn) => {
    await txn.execAsync(`COMMIT; PRAGMA busy_timeout = ${BUSY_TIMEOUT_MS}; BEGIN IMMEDIATE;`);
    await task(txn);
  });
}

// create / get / update / remove for one synced table.
export function syncedTable(table) {
  assertSyncedTable(table);
  return {
    create: (db, values) => insertRow(db, table, values),
    get: (db, id) => getRow(db, table, id),
    update: (db, id, changes) => updateRow(db, table, id, changes),
    remove: (db, id) => softDeleteRow(db, table, id),
  };
}
