// The synced tables' text limits live in two places (PLAN.md, C1: the
// server's rules equal the phone's): MAX_LENGTH on the phone and the server's
// checks. This follows every check through the migrations, in the order they
// run (a later add or drop wins), and compares, so a limit changed on one
// side only fails here.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { MAX_LENGTH } from '../src/lib/textLimits';

const MIGRATIONS = path.join(__dirname, '../supabase/migrations');

const SYNCED_TABLES = ['vehicle', 'place', 'place_rate', 'public_holiday', 'parking_session'];
// A name, quoted or not.
const NAME = String.raw`"?(\w+)"?`;
const ALTER_TABLE = new RegExp(String.raw`alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?(?:"?public"?\.)?${NAME}([^;]*);`, 'gi');
const DROP = new RegExp(String.raw`drop\s+constraint\s+(?:if\s+exists\s+)?${NAME}`, 'gi');
const ADD_CHECK = new RegExp(String.raw`add\s+constraint\s+${NAME}\s+check\s*\((.*)\)(?:\s+not\s+valid)?\s*(?:,|$)`, 'gim');

// Each check still in force after every migration: name -> { table, check }.
// A check clause on a synced table that these patterns cannot read fails,
// rather than leaving a server-only change unseen.
function serverChecks() {
  const checks = new Map();
  for (const file of readdirSync(MIGRATIONS).filter((name) => name.endsWith('.sql')).sort()) {
    const sql = readFileSync(path.join(MIGRATIONS, file), 'utf8').replace(/--[^\n]*/g, '');
    for (const [, table, body] of sql.matchAll(ALTER_TABLE)) {
      if (!SYNCED_TABLES.includes(table)) continue;
      let unread = body;
      for (const [clause, name] of body.matchAll(DROP)) {
        checks.delete(name);
        unread = unread.replace(clause, '');
      }
      for (const [clause, name, check] of body.matchAll(ADD_CHECK)) {
        checks.set(name, { table, check: check.trim() });
        unread = unread.replace(clause, '');
      }
      if (/\bcheck\b/i.test(unread)) throw new Error(`${file}: a check on ${table} this test cannot read: ${unread.trim()}`);
      // A length in a column's type (varchar(100)) is a limit too, kept in checks here.
      if (/\btype\s+(?:varchar|character\s+varying|char|character|bpchar)\s*\(/i.test(body)) {
        throw new Error(`${file}: a column type with a length on ${table}, which this test cannot compare`);
      }
    }
  }
  return checks;
}

// A check that limits a length: through a length function, or a pattern
// with a count ('^.{0,100}$'). The zone colour's format counts hex digits.
const LENGTH_CHECK = /\b(?:char(?:acter)?_length|length|octet_length)\s*\(|\.\{/i;

// { table: { column: length } } from the char_length checks; any other length
// check fails, as one this test cannot compare.
function serverTextLimits() {
  const limits = {};
  for (const [name, { table, check }] of serverChecks()) {
    if (!LENGTH_CHECK.test(check) || name === 'parking_session_rate_snapshot_size') continue;
    const match = /^char(?:acter)?_length\(\s*"?(\w+)"?\s*\)\s*<=\s*(\d+)$/i.exec(check);
    if (!match) throw new Error(`${name}: a length check this test cannot read: ${check}`);
    limits[table] = { ...limits[table], [match[1]]: Number(match[2]) };
  }
  return limits;
}

// The rate snapshot is measured differently on each side (its JSON text on the phone).
const phoneTextLimits = () =>
  Object.fromEntries(
    Object.entries(MAX_LENGTH).map(([table, columns]) => [
      table,
      Object.fromEntries(Object.entries(columns).filter(([column]) => column !== 'rate_snapshot')),
    ])
  );

it('has the same text limits on the phone as on the server', () => {
  expect(serverTextLimits()).toEqual(phoneTextLimits());
});

it('lets the server take any rate snapshot the phone takes', () => {
  const snapshot = serverChecks().get('parking_session_rate_snapshot_size');
  const [, serverBytes] = /^octet_length\(\s*rate_snapshot::text\s*\)\s*<=\s*(\d+)$/i.exec(snapshot?.check ?? '') ?? [];

  // The server prints the JSON with a space after every : and , (at most two
  // more characters for every three), and the snapshot is ASCII.
  expect(Number(serverBytes)).toBeGreaterThanOrEqual(Math.ceil((MAX_LENGTH.parking_session.rate_snapshot * 5) / 3));
});

it('reads the checks it compares', () => {
  expect(serverChecks().get('parking_session_note_length')).toEqual({
    table: 'parking_session',
    check: 'char_length(note) <= 500',
  });
});
