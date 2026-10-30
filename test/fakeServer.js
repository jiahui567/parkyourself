// A stand-in for the server's side of the sync, in memory, for one account:
// push_synced_rows and pull_synced_rows (supabase/migrations/), so Jest can
// run two phones against one server (src/cloud/syncTwoPhones.test.js). It
// keeps the rules the phones meet there: last write wins by updated_at, only
// the columns sent are written, the text limits, unique rules and foreign keys
// refuse a row alone, and every row of one call shares one stamp, as rows of
// one transaction share now(). pgTAP tests the real functions.
import { characterCount, MAX_LENGTH } from '../src/lib/textLimits';

const TABLES = ['vehicle', 'place', 'place_rate', 'public_holiday', 'parking_session'];

// lower(name collate "C") folds only A to Z, like the phone's NOCASE.
const nocase = (text) => String(text).replace(/[A-Z]/g, (c) => c.toLowerCase());

const UNIQUE = {
  place: ['place_name_unique', (row) => nocase(row.name)],
  place_rate: ['place_rate_unique', (row) => `${row.place_id}|${row.day_type}`],
  public_holiday: ['public_holiday_unique', (row) => row.holiday_date],
  parking_session: ['one_active_session_per_vehicle', (row) => (row.status === 'active' ? row.vehicle_id : null)],
};

const FOREIGN = {
  place_rate: [['place_id', 'place']],
  parking_session: [
    ['vehicle_id', 'vehicle'],
    ['place_id', 'place'],
  ],
};

// What crosses the network is JSON.
const overTheWire = (value) => JSON.parse(JSON.stringify(value));

const byStampThenId = (a, b) => a.server_updated_us - b.server_updated_us || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

// Each call is stamped two minutes after the last, longer than the pull's
// overlap (PULL_OVERLAP_US), so a pull reads only what came after where it was
// up to, and a cursor that skipped a row would show.
const CALL_GAP_US = 2 * 60 * 1000 * 1000;

export function createFakeServer() {
  const tables = Object.fromEntries(TABLES.map((table) => [table, new Map()]));
  let clock = Date.UTC(2026, 9, 1) * 1000;

  // The checks of *_synced_text_limits.sql on the row as sent, which
  // PostgreSQL tests before it looks for the row's id, so even a change that
  // would be skipped as older is refused. char_length counts characters, not
  // UTF-16 units.
  function brokenCheck(table, sent) {
    const check = (constraint) => ({ id: sent.id, code: '23514', constraint, other: null });
    const tooLong = Object.entries(MAX_LENGTH[table] ?? {}).find(
      ([column, max]) => column !== 'rate_snapshot' && typeof sent[column] === 'string' && characterCount(sent[column]) > max
    );
    if (tooLong) return check(`${table}_${tooLong[0]}_length`);
    if (table !== 'parking_session') return null;
    if (sent.zone_colour_hex != null && !/^#[0-9A-Fa-f]{6}$/.test(sent.zone_colour_hex)) {
      return check('parking_session_zone_colour_hex_format');
    }
    // The server measures its own printing of the JSON, a little longer than this.
    if (sent.rate_snapshot != null && JSON.stringify(sent.rate_snapshot).length > 8192) {
      return check('parking_session_rate_snapshot_size');
    }
    return null;
  }

  function refusal(table, sent, next) {
    const missing = (FOREIGN[table] ?? []).find(
      ([column, parent]) => next[column] != null && !tables[parent].has(next[column])
    );
    if (missing) return { id: sent.id, code: '23503', constraint: `${table}_${missing[0]}_fkey`, other: null };
    if (!UNIQUE[table] || next.deleted_at != null) return null;
    const [constraint, keyOf] = UNIQUE[table];
    const key = keyOf(next);
    if (key == null) return null;
    const clash = [...tables[table].values()].find((r) => r.id !== next.id && r.deleted_at == null && keyOf(r) === key);
    if (!clash) return null;
    const other =
      table === 'parking_session'
        ? { id: clash.id, level: clash.level, bay: clash.bay, started_at: clash.started_at }
        : null;
    return { id: sent.id, code: '23505', constraint, other };
  }

  return {
    push(table, rows) {
      clock += CALL_GAP_US;
      const stamp = clock;
      const refused = [];
      for (const sent of overTheWire(rows)) {
        const broken = brokenCheck(table, sent);
        if (broken) {
          refused.push(broken);
          continue;
        }
        const current = tables[table].get(sent.id);
        // An older change is skipped, not refused.
        if (current && !(sent.updated_at > current.updated_at)) continue;
        const next = { ...current, ...sent, server_updated_us: stamp };
        const refused1 = refusal(table, sent, next);
        if (refused1) refused.push(refused1);
        else tables[table].set(sent.id, next);
      }
      return refused;
    },

    pull(table, { afterUs, afterId, limit }) {
      const later = [...tables[table].values()]
        .sort(byStampThenId)
        .filter(
          (row) =>
            afterUs == null ||
            row.server_updated_us > afterUs ||
            (afterId != null && row.server_updated_us === afterUs && row.id > afterId)
        );
      return overTheWire(later.slice(0, limit));
    },

    // Every row of a table, deleted ones too, without the server's stamp.
    rows(table) {
      const rows = [...tables[table].values()].map(({ server_updated_us: _stamp, ...row }) => row);
      return overTheWire(rows.sort((a, b) => (a.id < b.id ? -1 : 1)));
    },
  };
}
