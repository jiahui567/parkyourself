// The server's car park list comes from a migration written by
// `npm run carparks:sql` from src/carparks/carParkList.json (PLAN.md, M12).
// Phones that have downloaded the list never use the built-in copy again, so
// a change to the JSON that never reached a migration would be lost on them.
const fs = require('node:fs');
const path = require('node:path');

const { carParkListSql, MIGRATIONS_DIR, newestDataMigration, readList } = require('../scripts/car-park-sql');

describe('the car park list migration', () => {
  it('matches carParkList.json (run npm run carparks:sql after changing the list)', () => {
    const newest = newestDataMigration();

    expect(newest).not.toBeNull();
    expect(fs.readFileSync(path.join(MIGRATIONS_DIR, newest), 'utf8')).toBe(carParkListSql(readList()));
  });

  it('doubles quotes in text', () => {
    const sql = carParkListSql({
      version: 'x',
      carParks: [{ id: 'a', name: "Touch 'n Go Mall", source_url: 'https://x', checked_on: '2026-10-24', rates: [] }],
    });

    expect(sql).toContain("'Touch ''n Go Mall'");
  });
});
