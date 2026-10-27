import { inTransaction, now } from './core';
import { settings } from './settings';
import { PHONE_ONLY_COLUMNS, pulledKey, SYNCED_TABLES } from './sync';

// The pull's side on the phone (C4; PLAN.md, "How the sync works", steps 4
// and 8): writing the rows the server sent into SQLite, merging them with the
// rows made here when two break a unique rule, and where each table's pull is
// up to. src/cloud/sync.js fetches the rows and calls syncPull.apply.
//
// The merges run here, on the phone (decided 2026-10-27): the server refuses a
// row that breaks a rule, and the phone that holds it merges once the other
// row arrives, then pushes the result. Only that phone holds both rows, so
// only it decides. Every write here sets dirty = 1 on what the sync changed,
// so the next push sends it.

// Told after a pull changed what screens show, so the one in front loads
// again (src/hooks/useFocusedLoad.js).
const pulledListeners = new Set();

export function onPulledChange(listener) {
  pulledListeners.add(listener);
  return () => pulledListeners.delete(listener);
}

// Called by the sync once it has finished (src/cloud/sync.js), after its
// second push and the state Settings and Find read, so the screens show how
// it ended.
export function tellPulledChange() {
  pulledListeners.forEach((listener) => listener());
}

// The rows each table's rows point at. A row whose car or place is not on the
// phone yet waits for a later pull: it was made on the server after its
// parent's table was read.
const PARENTS = {
  place_rate: [['place_id', 'place']],
  parking_session: [
    ['vehicle_id', 'vehicle'],
    ['place_id', 'place'],
  ],
};

// The live row on the phone that a live pulled row would break a unique rule
// with, as [sql, params], or null when the table has no rule for it. The same
// rules as the indexes in src/db/migrations.js.
const CLASH = {
  place: (row) => ['SELECT * FROM place WHERE deleted_at IS NULL AND id <> ? AND name = ? COLLATE NOCASE', [row.id, row.name]],
  place_rate: (row) => [
    'SELECT * FROM place_rate WHERE deleted_at IS NULL AND id <> ? AND place_id = ? AND day_type = ?',
    [row.id, row.place_id, row.day_type],
  ],
  public_holiday: (row) => [
    'SELECT * FROM public_holiday WHERE deleted_at IS NULL AND id <> ? AND holiday_date = ?',
    [row.id, row.holiday_date],
  ],
  parking_session: (row) =>
    row.status === 'active'
      ? [
          "SELECT * FROM parking_session WHERE deleted_at IS NULL AND status = 'active' AND id <> ? AND vehicle_id = ?",
          [row.id, row.vehicle_id],
        ]
      : null,
};

// a was changed after b: by updated_at, then by id, so every phone picks the same.
const isNewer = (a, b) => a.updated_at > b.updated_at || (a.updated_at === b.updated_at && a.id > b.id);
// a was made before b: by created_at, then by id.
const isOlder = (a, b) => a.created_at < b.created_at || (a.created_at === b.created_at && a.id < b.id);

// The time of a change the sync makes to row: now, or just after the row's own
// time when the phone's clock is behind, so the change wins on the server.
const after = (row, t) => Math.max(t, row.updated_at + 1);

// SQLite's NOCASE folds only A to Z.
const nocase = (text) => String(text).replace(/[A-Z]/g, (c) => c.toLowerCase());

// When a place last changed, counting its rates: the duplicate changed most
// recently is kept (PLAN.md, step 8; decided 2026-10-27).
export function placeLastChange(place, rates) {
  return rates.reduce((latest, rate) => Math.max(latest, rate.updated_at), place.updated_at);
}

// A server row's values for the phone's columns it has (PLAN.md, "Type
// mapping", backwards): booleans as 0/1 and JSON (the rate snapshot) as text.
// Columns the server has and the phone does not are left out.
export function fromServerRow(row, columns) {
  const values = {};
  for (const column of columns) {
    if (!Object.hasOwn(row, column)) continue;
    const value = row[column];
    if (typeof value === 'boolean') values[column] = Number(value);
    else if (value !== null && typeof value === 'object') values[column] = JSON.stringify(value);
    else values[column] = value;
  }
  return values;
}

// The table's columns that sync. The names come from SQLite itself, so they
// are safe to put in SQL text.
async function syncedColumns(txn, table) {
  const info = await txn.getAllAsync(`PRAGMA table_info(${table})`);
  return info.map((c) => c.name).filter((name) => !PHONE_ONLY_COLUMNS.includes(name));
}

// Adds or replaces the row as the server sent it (or as a merge changed it).
// A session another phone parked shows no notifications here (parked_here 0);
// an update keeps the phone's own value.
async function writeRow(txn, ctx, row, dirty) {
  const values = fromServerRow(row, ctx.columns);
  const columns = Object.keys(values);
  const inserted = [...columns, 'dirty', ...(ctx.table === 'parking_session' ? ['parked_here'] : [])];
  const params = [...columns.map((c) => values[c]), dirty, ...(ctx.table === 'parking_session' ? [0] : [])];
  const updates = [...columns.filter((c) => c !== 'id'), 'dirty'].map((c) => `${c} = excluded.${c}`);
  await txn.runAsync(
    `INSERT INTO ${ctx.table} (${inserted.join(', ')}) VALUES (${inserted.map(() => '?').join(', ')})
     ON CONFLICT(id) DO UPDATE SET ${updates.join(', ')}`,
    params
  );
}

// row as a deletion the sync makes, to push.
const deletionOf = (row, t) => ({ ...row, deleted_at: after(row, t), updated_at: after(row, t) });

async function softDelete(txn, table, row, t) {
  await txn.runAsync(`UPDATE ${table} SET deleted_at = ?, updated_at = ?, dirty = 1 WHERE id = ?`, [
    after(row, t),
    after(row, t),
    row.id,
  ]);
}

// Every rate of a place, deleted ones too (a deletion is a change).
const ratesOf = (txn, placeId) => txn.getAllAsync('SELECT id, updated_at FROM place_rate WHERE place_id = ?', [placeId]);

// What to do when a pulled row (row) breaks a unique rule with a row made on
// this phone (local, not on the server yet): PLAN.md, "How the sync works",
// step 8. Each returns how many rows it changed for the next push.
const MERGE = {
  // Two places with one name: the one changed most recently, counting its
  // rates (the pulled place's rates in this pull too), is kept. The other is
  // deleted and names it in merged_into; settle() then moves its rates and
  // sessions there, on every phone.
  async place(txn, ctx, row, local) {
    const pulledRates = [
      ...(await ratesOf(txn, row.id)),
      ...ctx.pulled.place_rate.filter((rate) => rate.place_id === row.id),
    ];
    const pulledChange = { id: row.id, updated_at: placeLastChange(row, pulledRates) };
    const localChange = { id: local.id, updated_at: placeLastChange(local, await ratesOf(txn, local.id)) };
    if (isNewer(pulledChange, localChange)) {
      await txn.runAsync('UPDATE place SET deleted_at = ?, updated_at = ?, merged_into = ?, dirty = 1 WHERE id = ?', [
        after(local, ctx.t),
        after(local, ctx.t),
        row.id,
        local.id,
      ]);
      await writeRow(txn, ctx, row, 0);
    } else {
      await writeRow(txn, ctx, { ...deletionOf(row, ctx.t), merged_into: local.id }, 1);
    }
    return 1;
  },

  // Two live rates for one place and day type: the newer wins.
  async place_rate(txn, ctx, row, local) {
    if (isNewer(row, local)) {
      await softDelete(txn, 'place_rate', local, ctx.t);
      await writeRow(txn, ctx, row, 0);
    } else {
      await writeRow(txn, ctx, deletionOf(row, ctx.t), 1);
    }
    return 1;
  },

  // The same date twice: the older row is kept, with the other's name if it
  // has none.
  async public_holiday(txn, ctx, row, local) {
    if (isOlder(row, local)) {
      await softDelete(txn, 'public_holiday', local, ctx.t);
      if (row.name || !local.name) {
        await writeRow(txn, ctx, row, 0);
        return 1;
      }
      await writeRow(txn, ctx, { ...row, name: local.name, updated_at: after(row, ctx.t) }, 1);
      return 2;
    }
    await writeRow(txn, ctx, deletionOf(row, ctx.t), 1);
    if (local.name || !row.name) return 1;
    await txn.runAsync('UPDATE public_holiday SET name = ?, updated_at = ?, dirty = 1 WHERE id = ?', [
      row.name,
      after(local, ctx.t),
      local.id,
    ]);
    return 2;
  },
};

// Writes one pulled row. resolve: false on the first pass, which sets aside a
// row that breaks a unique rule, since a later row of the same pull may free
// the rule (a place renamed or deleted on the server); true on the second,
// which merges. Returns { outcome, dirtied }; outcome is 'same', 'kept',
// 'written', 'merged', 'clash' (set aside) or 'held' (not stored: tried again
// at the next pull).
async function applyRow(txn, ctx, row, resolve) {
  const { table } = ctx;
  const local = await txn.getFirstAsync(`SELECT * FROM ${table} WHERE id = ?`, [row.id]);
  if (local) {
    // The phone's own change is newer: it is pushed next and wins there too.
    if (local.dirty && local.updated_at > row.updated_at) return { outcome: 'kept', dirtied: 0 };
    // Pulled again through the overlap, unchanged; or an older copy than the
    // phone has from the server (the server takes only newer changes, so a
    // clean row is one of its versions), such as a row set aside on the first
    // pass whose newer copy came later in the same pull.
    if (!local.dirty && local.updated_at >= row.updated_at) return { outcome: 'same', dirtied: 0 };
  }
  for (const [column, parent] of PARENTS[table] ?? []) {
    if (row[column] == null) continue;
    if (!(await txn.getFirstAsync(`SELECT 1 AS found FROM ${parent} WHERE id = ?`, [row[column]]))) {
      return { outcome: 'held', dirtied: 0 };
    }
  }
  const query = row.deleted_at == null ? CLASH[table]?.(row) : null;
  const clash = query ? await txn.getFirstAsync(...query) : null;
  if (clash) {
    if (!resolve) return { outcome: 'clash', dirtied: 0 };
    // A clean row is on the server too, so the server's change that frees the
    // rule has not arrived yet. Two active sessions for one car are never
    // merged: the other phone's waits here until one of them ends (Find says
    // so on this phone's).
    if (!clash.dirty || table === 'parking_session') return { outcome: 'held', dirtied: 0 };
    return { outcome: 'merged', dirtied: await MERGE[table](txn, ctx, row, clash) };
  }
  await writeRow(txn, ctx, row, 0);
  return { outcome: 'written', dirtied: 0 };
}

// Rows written per transaction. Each holds SQLite's write lock while it runs,
// and a save the user makes meanwhile waits up to BUSY_TIMEOUT_MS
// (src/db/migrate.js) for it, so a first sync with years of parking is many
// short transactions rather than one long one.
export const WRITE_CHUNK = 200;

// The same row twice in one pull, when it changed between two pages: only
// its last copy, the newest, is kept, in its place in the server's order.
function lastCopies(rows) {
  const last = new Map(rows.map((row, index) => [row.id, index]));
  return rows.filter((row, index) => last.get(row.id) === index);
}

// Writes one table's pulled rows, counting into counts ({ changed, dirtied }).
// The table's cursor moves only in the last transaction, once every row is
// written: to the latest stamp stored, or to just before the first row held
// back, so it comes again. A sync stopped part of the way pulls the same rows
// again, and those already written count as the same.
async function applyTable(db, table, pulledRows, pulled, t, counts) {
  const rows = lastCopies(pulledRows);
  const ctx = { table, columns: await syncedColumns(db, table), pulled, t };
  let heldAt = Infinity;
  const tally = (row, { outcome, dirtied }) => {
    if (outcome === 'written' || outcome === 'merged') counts.changed += 1;
    if (outcome === 'held') heldAt = Math.min(heldAt, row.server_updated_us);
    counts.dirtied += dirtied;
  };
  const setAside = [];
  for (let start = 0; start < rows.length; start += WRITE_CHUNK) {
    await inTransaction(db, async (txn) => {
      for (const row of rows.slice(start, start + WRITE_CHUNK)) {
        const result = await applyRow(txn, ctx, row, false);
        if (result.outcome === 'clash') setAside.push(row);
        else tally(row, result);
      }
    });
  }
  const latest = rows.reduce((max, row) => Math.max(max, row.server_updated_us), 0);
  await inTransaction(db, async (txn) => {
    for (const row of setAside) tally(row, await applyRow(txn, ctx, row, true));
    await settings.set(txn, pulledKey(table), String(Math.min(latest, heldAt - 1)));
  });
}

// Places and cars the sync merged away: id → the id each became.
async function mergedIds(txn, table) {
  const rows = await txn.getAllAsync(
    `SELECT id, merged_into FROM ${table} WHERE deleted_at IS NOT NULL AND merged_into IS NOT NULL`
  );
  return new Map(rows.map((row) => [row.id, row.merged_into]));
}

// The live row id ends at by following merged, or null when the chain ends on
// a deleted row, one not pulled yet, or goes round.
async function liveEnd(txn, table, merged, id) {
  const seen = new Set();
  let current = id;
  while (merged.has(current)) {
    if (seen.has(current)) return null;
    seen.add(current);
    current = merged.get(current);
  }
  if (current === id) return null;
  const row = await txn.getFirstAsync(`SELECT id FROM ${table} WHERE id = ? AND deleted_at IS NULL`, [current]);
  return row ? current : null;
}

// Two cars in use with the same name are one car (decided 2026-10-27): a new
// phone asks for a car before it can sign in, so the first pull often brings
// the same car again. The older is kept, the default if either was; the other
// is deleted and names it in merged_into. Not while both are parked, which
// would park one car twice: they merge once one is found.
async function mergeSameNameCars(txn, t) {
  const cars = await txn.getAllAsync(
    'SELECT * FROM vehicle WHERE deleted_at IS NULL AND archived = 0 ORDER BY created_at, id'
  );
  const parked = new Set(
    (await txn.getAllAsync("SELECT vehicle_id FROM parking_session WHERE status = 'active' AND deleted_at IS NULL")).map(
      (row) => row.vehicle_id
    )
  );
  const kept = new Map();
  let dirtied = 0;
  for (const car of cars) {
    const keeper = kept.get(nocase(car.name));
    if (!keeper) {
      kept.set(nocase(car.name), car);
      continue;
    }
    if (parked.has(car.id) && parked.has(keeper.id)) continue;
    await txn.runAsync(
      'UPDATE vehicle SET deleted_at = ?, updated_at = ?, merged_into = ?, is_default = 0, dirty = 1 WHERE id = ?',
      [after(car, t), after(car, t), keeper.id, car.id]
    );
    dirtied += 1;
    if (car.is_default && !keeper.is_default) {
      await txn.runAsync('UPDATE vehicle SET is_default = 1, updated_at = ?, dirty = 1 WHERE id = ?', [
        after(keeper, t),
        keeper.id,
      ]);
      keeper.is_default = 1;
      dirtied += 1;
    }
    // Its session moves to the kept car below.
    if (parked.has(car.id)) parked.add(keeper.id);
  }
  return dirtied;
}

// Moves the live rates and sessions of merged-away places and cars to the
// row each became, here or on another phone. A moved rate that meets a live
// one for the same day type: the newer wins. A parked session stays on the
// merged car while the kept car is parked too.
async function followMerges(txn, t) {
  const places = await mergedIds(txn, 'place');
  const cars = await mergedIds(txn, 'vehicle');
  let dirtied = 0;
  const repoint = async (table, column, row, target) => {
    await txn.runAsync(`UPDATE ${table} SET ${column} = ?, updated_at = ?, dirty = 1 WHERE id = ?`, [
      target,
      after(row, t),
      row.id,
    ]);
    dirtied += 1;
  };

  const MERGED_PLACE = 'SELECT id FROM place WHERE deleted_at IS NOT NULL AND merged_into IS NOT NULL';
  // Newest first: a moved rate takes the time of the move, so a rate moved
  // after it to the same place and day type would lose whatever its own age.
  const rates = await txn.getAllAsync(
    `SELECT * FROM place_rate WHERE deleted_at IS NULL AND place_id IN (${MERGED_PLACE}) ORDER BY updated_at DESC, id DESC`
  );
  for (const rate of rates) {
    const target = await liveEnd(txn, 'place', places, rate.place_id);
    if (!target) continue;
    const there = await txn.getFirstAsync(
      'SELECT * FROM place_rate WHERE deleted_at IS NULL AND place_id = ? AND day_type = ?',
      [target, rate.day_type]
    );
    if (there && !isNewer(rate, there)) {
      await softDelete(txn, 'place_rate', rate, t);
      dirtied += 1;
      continue;
    }
    if (there) {
      await softDelete(txn, 'place_rate', there, t);
      dirtied += 1;
    }
    await repoint('place_rate', 'place_id', rate, target);
  }

  const atPlaces = await txn.getAllAsync(
    `SELECT id, place_id, updated_at FROM parking_session WHERE deleted_at IS NULL AND place_id IN (${MERGED_PLACE})`
  );
  for (const session of atPlaces) {
    const target = await liveEnd(txn, 'place', places, session.place_id);
    if (target) await repoint('parking_session', 'place_id', session, target);
  }

  const ofCars = await txn.getAllAsync(
    `SELECT id, vehicle_id, status, updated_at FROM parking_session
     WHERE deleted_at IS NULL AND vehicle_id IN (SELECT id FROM vehicle WHERE deleted_at IS NOT NULL AND merged_into IS NOT NULL)`
  );
  for (const session of ofCars) {
    const target = await liveEnd(txn, 'vehicle', cars, session.vehicle_id);
    if (!target) continue;
    if (session.status === 'active') {
      const parked = await txn.getFirstAsync(
        "SELECT id FROM parking_session WHERE vehicle_id = ? AND status = 'active' AND deleted_at IS NULL",
        [target]
      );
      if (parked) continue;
    }
    await repoint('parking_session', 'vehicle_id', session, target);
  }
  return dirtied;
}

// One default car: cars added on two phones before they synced are each the
// first, so each the default. The older stays the default, on every phone.
async function oneDefaultCar(txn, t) {
  const defaults = await txn.getAllAsync(
    'SELECT id, updated_at FROM vehicle WHERE deleted_at IS NULL AND archived = 0 AND is_default = 1 ORDER BY created_at, id'
  );
  for (const car of defaults.slice(1)) {
    await txn.runAsync('UPDATE vehicle SET is_default = 0, updated_at = ?, dirty = 1 WHERE id = ?', [after(car, t), car.id]);
  }
  return Math.max(0, defaults.length - 1);
}

export const syncPull = {
  // Where table's pull is up to: the latest server_updated_us stored, or null
  // before its first pull.
  async cursor(db, table) {
    const value = Number(await settings.get(db, pulledKey(table)));
    return value > 0 ? value : null;
  },

  // Writes a pull into SQLite: pulled is { table: rows } for the synced
  // tables, each table's rows in the server's order. Parents first, in short
  // transactions (applyTable), then one for settling the merges. Returns
  // { changed, dirtied }: how many rows changed here, and how many of those
  // wait for the next push. The caller tells the screens (tellPulledChange)
  // when it is done; this does only when it fails after changing rows.
  async apply(db, pulled) {
    const t = now();
    const all = Object.fromEntries(SYNCED_TABLES.map((table) => [table, pulled[table] ?? []]));
    const counts = { changed: 0, dirtied: 0 };
    try {
      for (const table of SYNCED_TABLES) {
        if (all[table].length) await applyTable(db, table, all[table], all, t, counts);
      }
      // Every sync, not only when something came: a merge waits for a row
      // pulled earlier, or for a parked car to be found.
      await inTransaction(db, async (txn) => {
        const cars = await mergeSameNameCars(txn, t);
        const settled = cars + (await followMerges(txn, t)) + (await oneDefaultCar(txn, t));
        counts.changed += settled;
        counts.dirtied += settled;
      });
    } catch (e) {
      if (counts.changed > 0) tellPulledChange();
      throw e;
    }
    return counts;
  },
};
