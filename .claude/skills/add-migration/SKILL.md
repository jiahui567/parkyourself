---
name: add-migration
description: Use before changing the Park Yourself database schema (new table, column or index) or fixing data in a migration. Covers adding a migration step safely, the synced-table rules, and the tests to update.
---

# Add a migration

Phones keep their database between app versions. Every schema change is a new step at the end of `MIGRATIONS` in `src/db/migrations.js`, applied once per phone and tracked by `PRAGMA user_version`.

## Steps

1. Append a new template string to `MIGRATIONS` with a comment `// vN: <what it changes>`. Never edit an earlier step: phones have already run it.
2. Prefer additive changes: `CREATE TABLE`, `CREATE INDEX`, `ALTER TABLE ... ADD COLUMN` (nullable or with a `DEFAULT`). To rename a column or change its type, create a new table, copy the rows, drop the old table and rename the new one, all inside the same step.
3. A new **synced** table has `id TEXT PRIMARY KEY`, `created_at`, `updated_at` and `deleted_at`; unique indexes end with `WHERE deleted_at IS NULL`; add its writable columns to `SYNCED_COLUMNS` in `src/db/core.js`. A **local-only** table says so in a SQL comment.
4. A new column on a synced table also goes into `SYNCED_COLUMNS`, otherwise writes through `core.js` reject it.
5. Tests:
   - Update the table list in `src/db/migrate.test.js` if tables changed.
   - Test new data functions with `openMigratedTestDatabase()` from `test/testDatabase.js`.
   - Add an upgrade test: build the previous version, add a row, migrate, and check the row survived with the right new values.
     ```js
     const db = openTestDatabase();
     for (let v = 0; v < MIGRATIONS.length - 1; v++) {
       await db.execAsync(MIGRATIONS[v]);
       await db.execAsync(`PRAGMA user_version = ${v + 1}`);
     }
     await db.runAsync('INSERT INTO ...', [...]); // a row in the old shape
     await migrate(db);
     // expect the row and the new column's value
     ```
   - Add a check to `src/db/selfTest.js` only for behaviour that needs the phone's driver.
6. Update PLAN.md, section "Data model". Keep changes additive so phones on an older app version can still sync later (PLAN.md, "Changing the schema in two databases").
7. Run `npm run lint` and `npm test`. On the phone: the schema version on Database check goes up by one and the self-test passes.
