import * as Crypto from 'expo-crypto';

// Columns callers may set on each synced table. id, created_at, updated_at and
// deleted_at are managed here. Table and column names cannot be bound as SQL
// parameters, so this list is also what makes them safe to put in SQL text.
const SYNCED_COLUMNS = {
  vehicle: ['name', 'colour', 'is_default', 'archived'],
  place: ['name', 'note', 'lat', 'lng', 'last_used_at'],
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
  await db.runAsync(
    `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
    params
  );
  return id;
}

// Returns the number of rows changed (0 if the row is missing or deleted).
export async function updateRow(db, table, id, changes) {
  const entries = toEntries(table, changes);
  const sets = [...entries.map(([c]) => `${c} = ?`), 'updated_at = ?'];
  const result = await db.runAsync(
    `UPDATE ${table} SET ${sets.join(', ')} WHERE id = ? AND deleted_at IS NULL`,
    [...entries.map(([, v]) => v), now(), id]
  );
  return result.changes;
}

// Synced tables are never DELETEd, so the deletion can be synced later.
export async function softDeleteRow(db, table, id) {
  assertSyncedTable(table);
  const t = now();
  const result = await db.runAsync(
    `UPDATE ${table} SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`,
    [t, t, id]
  );
  return result.changes;
}

export function getRow(db, table, id) {
  assertSyncedTable(table);
  return db.getFirstAsync(`SELECT * FROM ${table} WHERE id = ? AND deleted_at IS NULL`, [id]);
}

// Runs task(txn) on its own connection so unrelated queries cannot slip into
// the transaction. Every query inside must go through txn, not db.
export function inTransaction(db, task) {
  return db.withExclusiveTransactionAsync(task);
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
