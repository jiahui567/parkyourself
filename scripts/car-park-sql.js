// Writes a Supabase migration that makes the server's car park list match
// src/carparks/carParkList.json (PLAN.md, M12). Run after every change to the
// JSON (and bump its version): `npm run carparks:sql`, then
// `npx supabase db reset`, `npx supabase test db`, and push it (README,
// "Version 2 server"). test/carParkSql.test.js fails while the newest
// migration and the JSON disagree, so a change cannot miss the server.
//
// The migration makes the whole list match in one transaction: car parks not
// in the JSON are removed, the rest are updated in place (rate reports, C10,
// point at them, so deleting and writing them again would delete every
// report), and every rate in their history is written again. The JSON is the
// one source; the server keeps no rows of its own.
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const LIST_FILE = path.join(ROOT, 'src', 'carparks', 'carParkList.json');
const MIGRATIONS_DIR = path.join(ROOT, 'supabase', 'migrations');
const DATA_MIGRATION = /^\d{14}_car_park_list_.+\.sql$/;
const RATE_COLUMNS = [
  'type',
  'first_minutes',
  'first_sen',
  'block_minutes',
  'block_sen',
  'grace_minutes',
  'daily_cap_sen',
  'flat_sen',
];

// A SQL literal for a value from the JSON (our own data, but notes can hold quotes).
function literal(value) {
  if (value == null) return 'null';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`Not a number: ${value}`);
    return String(value);
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}

// The migration's SQL for list. The same list always gives the same text.
function carParkListSql(list) {
  // The version goes into a comment line, where a line break would start SQL.
  if (typeof list.version !== 'string' || !/^[\w.-]+$/.test(list.version)) {
    throw new Error(`The list's version must be letters, digits, dots and dashes, such as 2026-10-24: ${list.version}`);
  }
  const carParkRows = list.carParks.map((c) =>
    [c.id, c.name, c.area, c.lat, c.lng, c.source_url, c.checked_on, c.notes].map(literal).join(', ')
  );
  const rateRows = list.carParks.flatMap((c) =>
    (c.rates ?? []).map((rate) =>
      [
        c.id,
        rate.day_type,
        rate.effective_from,
        ...RATE_COLUMNS.map((column) => rate[column] ?? (column === 'grace_minutes' ? 0 : null)),
      ]
        .map(literal)
        .join(', ')
    )
  );
  const rates = rateRows.length
    ? `insert into public.car_park_rate (car_park_id, day_type, effective_from, ${RATE_COLUMNS.join(', ')}) values
${rateRows.map((row) => `  (${row})`).join(',\n')};
`
    : '';
  const carParks = list.carParks.length
    ? `insert into public.car_park (id, name, area, lat, lng, source_url, checked_on, notes) values
${carParkRows.map((row) => `  (${row})`).join(',\n')}
on conflict (id) do update set
  name = excluded.name, area = excluded.area, lat = excluded.lat, lng = excluded.lng,
  source_url = excluded.source_url, checked_on = excluded.checked_on, notes = excluded.notes, updated_at = now();

-- A car park taken off the list takes its rate reports with it.
delete from public.car_park where id not in (${list.carParks.map((c) => literal(c.id)).join(', ')});
`
    : 'delete from public.car_park;\n';
  return `-- The car park list, version ${list.version}: ${list.carParks.length} car parks, ${rateRows.length} rates.
-- Written by \`npm run carparks:sql\` from src/carparks/carParkList.json; do not edit by hand.
${carParks}
delete from public.car_park_rate;
${rates}`;
}

// The newest car park list migration's file name, or null.
function newestDataMigration() {
  const names = fs.readdirSync(MIGRATIONS_DIR).filter((name) => DATA_MIGRATION.test(name));
  return names.sort().at(-1) ?? null;
}

function readList() {
  return JSON.parse(fs.readFileSync(LIST_FILE, 'utf8'));
}

module.exports = { carParkListSql, newestDataMigration, readList, MIGRATIONS_DIR };

if (require.main === module) {
  const list = readList();
  const sql = carParkListSql(list);
  const newest = newestDataMigration();
  if (newest && fs.readFileSync(path.join(MIGRATIONS_DIR, newest), 'utf8') === sql) {
    console.log(`Nothing to do: ${newest} already matches the list.`);
  } else {
    const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
    const file = path.join(MIGRATIONS_DIR, `${stamp}_car_park_list_${list.version.replace(/\W/g, '_')}.sql`);
    fs.writeFileSync(file, sql, 'utf8');
    console.log(`Wrote ${path.relative(ROOT, file)}. Check it on local Supabase, then push it.`);
  }
}
