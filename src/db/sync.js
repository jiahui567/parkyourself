import { settings } from './settings';

// The phone's side of the sync (C3; PLAN.md, "How the sync works"): the rows
// that wait to be pushed, marking them pushed, and what the phone remembers
// about its account. src/db/pull.js writes what the pull brings (C4), and
// src/cloud/sync.js runs both.
//
// Every write here is one statement on the main connection, never a
// transaction: a transaction holds SQLite's write lock on a connection of its
// own, and a save the user makes meanwhile would fail with "database is
// locked". The sync runs often enough (after every save) that it must not.

// Parents first, so a row's car or place reaches the server before the row.
// The list is also what makes a table name safe to put in SQL text.
export const SYNCED_TABLES = ['vehicle', 'place', 'place_rate', 'public_holiday', 'parking_session'];

function assertTable(table) {
  if (!SYNCED_TABLES.includes(table)) throw new Error(`Not a synced table: ${table}`);
}

// Columns of the synced tables that only mean something on this phone: the
// change tracking (C3) and which sessions it parked (C4). Never sent or pulled.
export const PHONE_ONLY_COLUMNS = ['dirty', 'parked_here'];

// A phone row in the server's shape (PLAN.md, "Type mapping"): none of the
// phone-only columns, the 0/1 flags as booleans and the rate snapshot as JSON
// instead of its text.
export function toServerRow(table, row) {
  assertTable(table);
  const serverRow = { ...row };
  for (const column of PHONE_ONLY_COLUMNS) delete serverRow[column];
  if (table === 'vehicle') {
    serverRow.is_default = Boolean(row.is_default);
    serverRow.archived = Boolean(row.archived);
  }
  if (table === 'parking_session' && row.rate_snapshot != null) {
    serverRow.rate_snapshot = JSON.parse(row.rate_snapshot);
  }
  return serverRow;
}

export const syncRows = {
  // The rows of table whose latest change has not reached the server: the
  // deleted ones first (a deletion syncs like any change), then the oldest
  // change first. The server checks its unique rules row by row, so a row that
  // frees a name (a place renamed, a session ended) must arrive before the one
  // that takes it. A deletion only ever frees one, and the sync's merges
  // delete the losing row at the moment they keep the other (src/db/pull.js).
  listDirty(db, table) {
    assertTable(table);
    return db.getAllAsync(`SELECT * FROM ${table} WHERE dirty = 1 ORDER BY deleted_at IS NULL, updated_at, id`);
  },

  // Marks rows pushed, each only if it has not changed since it was read (the
  // same updated_at), so an edit made during the push goes in the next one.
  // rows is one batch of the push (src/cloud/sync.js, PUSH_BATCH), well under
  // SQLite's limit on bound values.
  async markPushed(db, table, rows) {
    assertTable(table);
    if (!rows.length) return;
    const pairs = rows.map(() => '(?, ?)').join(', ');
    await db.runAsync(
      `UPDATE ${table} SET dirty = 0 WHERE (id, updated_at) IN (VALUES ${pairs})`,
      rows.flatMap((row) => [row.id, row.updated_at])
    );
  },

  // How many rows wait to be pushed, over the five tables.
  async countDirty(db) {
    const counts = SYNCED_TABLES.map((table) => `(SELECT COUNT(*) FROM ${table} WHERE dirty = 1)`);
    return (await db.getFirstAsync(`SELECT ${counts.join(' + ')} AS n`)).n;
  },
};

// How the signed-in account stands to the one this phone's rows are backed up
// to (owner; both { id, email }, owner null before the first sync):
// 'first' (none yet: the phone is backed up to it), 'same', 'recreated' (the
// same email with a new id: that account was deleted elsewhere, so the server
// no longer has this phone's rows, and they are all pushed again) or 'other'
// (a different person's account: it does not get this phone's rows unasked;
// PLAN.md, "How the sync works", step 9).
export function accountMatch(owner, account) {
  if (!owner) return 'first';
  if (owner.id === account.id) return 'same';
  const sameEmail = owner.email && account.email && owner.email.toLowerCase() === account.email.toLowerCase();
  return sameEmail ? 'recreated' : 'other';
}

// Kept in the setting table, one key each, so the sync and a sign-out that
// happen together never overwrite each other's part.
const KEY = {
  // The account signed in on this phone, as the last sign-in or sync saw it,
  // so Settings can show it without asking the server.
  accountId: 'sync_account_id',
  accountEmail: 'sync_account_email',
  // The account this phone's rows are backed up to. Kept after sign-out, so
  // signing in again with it carries on, and another account is not given
  // this phone's data without asking (PLAN.md, "How the sync works", step 9).
  ownerId: 'sync_owner_id',
  ownerEmail: 'sync_owner_email',
  lastSyncedAt: 'sync_last_synced_at',
  lastError: 'sync_last_error',
  // JSON: the rows the server refused at the last push, [{ table, id,
  // updated_at, code, constraint, other }].
  refused: 'sync_refused',
};

// Where the pull is up to in table (C4; PLAN.md's last_pulled_at, one per
// table, so a table pulled later in the same sync cannot move another's on):
// the latest server_updated_us stored, as text.
export const pulledKey = (table) => {
  assertTable(table);
  return `sync_pulled_${table}`;
};

async function readAccount(db, idKey, emailKey) {
  const id = await settings.get(db, idKey);
  return id ? { id, email: (await settings.get(db, emailKey)) || null } : null;
}

async function writeAccount(db, idKey, emailKey, account) {
  await settings.set(db, idKey, account?.id ?? '');
  await settings.set(db, emailKey, account?.email ?? '');
}

// The refusals whose row has not changed since: a row changed later is
// pushed again, so its old refusal no longer says anything about it. A
// refused session also gets its car's name, for the text.
async function currentRefusals(db, refused) {
  const current = [];
  for (const refusal of refused) {
    if (!SYNCED_TABLES.includes(refusal.table)) continue;
    const row = await db.getFirstAsync(`SELECT updated_at FROM ${refusal.table} WHERE id = ?`, [refusal.id]);
    if (row?.updated_at !== refusal.updated_at) continue;
    if (refusal.table === 'parking_session') {
      const car = await db.getFirstAsync(
        'SELECT v.name FROM parking_session s JOIN vehicle v ON v.id = s.vehicle_id WHERE s.id = ?',
        [refusal.id]
      );
      current.push({ ...refusal, vehicle_name: car?.name ?? null });
    } else {
      current.push(refusal);
    }
  }
  return current;
}

// Written only by finished() below, with JSON.stringify.
async function readRefused(db) {
  return currentRefusals(db, JSON.parse((await settings.get(db, KEY.refused)) || '[]'));
}

export const syncState = {
  // { account, owner, otherAccount, restarting, pending, lastSyncedAt,
  // lastError, refused }: account and owner as { id, email } or null;
  // otherAccount true when the phone is backed up to another person's
  // account, so nothing syncs; restarting true when the account signed in is
  // the owner's email made again, so everything goes at the next sync;
  // lastSyncedAt in epoch ms or null.
  async get(db) {
    const lastSyncedAt = Number(await settings.get(db, KEY.lastSyncedAt));
    const account = await readAccount(db, KEY.accountId, KEY.accountEmail);
    const owner = await readAccount(db, KEY.ownerId, KEY.ownerEmail);
    const match = account ? accountMatch(owner, account) : null;
    return {
      account,
      owner,
      otherAccount: match === 'other',
      restarting: match === 'recreated',
      pending: await syncRows.countDirty(db),
      lastSyncedAt: lastSyncedAt > 0 ? lastSyncedAt : null,
      lastError: (await settings.get(db, KEY.lastError)) || null,
      refused: await readRefused(db),
    };
  },

  // The refusal of the session sessionId at the last push, or null.
  async refusedSession(db, sessionId) {
    const refused = await readRefused(db);
    return refused.find((r) => r.table === 'parking_session' && r.id === sessionId) ?? null;
  },

  owner(db) {
    return readAccount(db, KEY.ownerId, KEY.ownerEmail);
  },

  // account: { id, email }, or null once signed out.
  setAccount(db, account) {
    return writeAccount(db, KEY.accountId, KEY.accountEmail, account);
  },

  setOwner(db, account) {
    return writeAccount(db, KEY.ownerId, KEY.ownerEmail, account);
  },

  // A push that went through: refused as the server gave it, each with the
  // table and the updated_at of the row that was sent.
  async finished(db, atMs, refused) {
    await settings.set(db, KEY.lastSyncedAt, String(atMs));
    await settings.set(db, KEY.lastError, '');
    await settings.set(db, KEY.refused, JSON.stringify(refused));
  },

  failed(db, message) {
    return settings.set(db, KEY.lastError, message);
  },

  // For when the server no longer has this phone's rows (the account they
  // were backed up to was deleted): every row waits to be pushed again, as at
  // a first sign-in, to owner ({ id, email }), or to whichever account signs
  // in next when owner is null; and the pull starts from the beginning.
  async startOver(db, owner) {
    for (const table of SYNCED_TABLES) {
      await db.runAsync(`UPDATE ${table} SET dirty = 1`);
      await settings.set(db, pulledKey(table), '');
    }
    await settings.set(db, KEY.lastSyncedAt, '');
    await settings.set(db, KEY.lastError, '');
    await settings.set(db, KEY.refused, '');
    await writeAccount(db, KEY.ownerId, KEY.ownerEmail, owner);
  },

  // After the signed-in account was deleted (Delete account): signed out, and
  // the rows backed up to it start over. Rows backed up to another person's
  // account stay with that one.
  async afterAccountDeleted(db) {
    const { otherAccount } = await syncState.get(db);
    if (!otherAccount) await syncState.startOver(db, null);
    await writeAccount(db, KEY.accountId, KEY.accountEmail, null);
  },
};
