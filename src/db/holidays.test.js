import { openMigratedTestDatabase } from '../../test/testDatabase';
import { holidays } from './holidays';

let db;
beforeEach(async () => {
  db = await openMigratedTestDatabase();
});
afterEach(() => db.close());

describe('holidays.add', () => {
  it('returns the existing id when the date is already in the list', async () => {
    const first = await holidays.add(db, { holiday_date: '2026-12-25', name: 'Christmas' });

    await expect(holidays.add(db, { holiday_date: ' 2026-12-25 ' })).resolves.toBe(first);
    expect(await holidays.list(db)).toHaveLength(1);
  });

  it('gives a date added without a name the name typed later', async () => {
    const id = await holidays.add(db, { holiday_date: '2026-12-25' });

    await holidays.add(db, { holiday_date: '2026-12-25', name: ' Christmas ' });

    expect((await holidays.get(db, id)).name).toBe('Christmas');
  });

  // The date shapes isDateKey accepts and rejects are tested in time.test.js.
  it('refuses a day that does not exist', async () => {
    await expect(holidays.add(db, { holiday_date: '2026-02-30' })).rejects.toThrow('YYYY-MM-DD');
  });
});

describe('holidays.list and dateSet', () => {
  it('lists the dates in order, without removed ones', async () => {
    await holidays.add(db, { holiday_date: '2026-12-25' });
    await holidays.add(db, { holiday_date: '2026-08-31' });
    await holidays.remove(db, await holidays.add(db, { holiday_date: '2026-10-20' }));

    expect((await holidays.list(db)).map((h) => h.holiday_date)).toEqual(['2026-08-31', '2026-12-25']);
    expect(await holidays.dateSet(db)).toEqual(new Set(['2026-08-31', '2026-12-25']));
  });
});
