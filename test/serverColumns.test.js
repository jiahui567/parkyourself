// The synced tables live in two databases (PLAN.md, "Changing the schema in
// two databases"). The pgTAP schema test lists each server table's columns and
// checks them on Supabase; this reads the same lists and checks them against
// the phone, so a column added on one side only fails one of the two.
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { openMigratedTestDatabase } from './testDatabase';

const SCHEMA_TEST = path.join(__dirname, '../supabase/tests/database/synced_tables_schema.test.sql');
const SERVER_ONLY = ['owner_id', 'server_updated_at'];
// The phone's change tracking for the push (C3), never sent.
const PHONE_ONLY = ['dirty'];

function serverColumnLists() {
  const sql = readFileSync(SCHEMA_TEST, 'utf8');
  return [...sql.matchAll(/columns_are\('public', '(\w+)', array\[([^\]]*)\]/g)].map(([, table, list]) => ({
    table,
    columns: [...list.matchAll(/'(\w+)'/g)].map((m) => m[1]),
  }));
}

describe('synced table columns', () => {
  const lists = serverColumnLists();

  it('reads a list for each of the five synced tables', () => {
    expect(lists.map((l) => l.table).sort()).toEqual(
      ['parking_session', 'place', 'place_rate', 'public_holiday', 'vehicle']
    );
  });

  it.each(lists)('$table has the same columns on the phone as on the server', async ({ table, columns }) => {
    const db = await openMigratedTestDatabase();
    // The table name comes from the fixed list checked above, not from input.
    const phone = await db.getAllAsync(`PRAGMA table_info(${table})`);

    expect(phone.map((c) => c.name).filter((c) => !PHONE_ONLY.includes(c)).sort()).toEqual(
      columns.filter((c) => !SERVER_ONLY.includes(c)).sort()
    );
  });
});
