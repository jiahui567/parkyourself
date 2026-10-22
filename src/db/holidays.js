import { isDateKey } from '../lib/time';
import { syncedTable } from './core';

const base = syncedTable('public_holiday');

// The user's own public holiday list (no internet calendar). Each date is
// 'YYYY-MM-DD' in local time and appears at most once.
export const holidays = {
  ...base,

  list(db) {
    return db.getAllAsync('SELECT * FROM public_holiday WHERE deleted_at IS NULL ORDER BY holiday_date');
  },

  // The dates as a Set, the shape the fee functions take.
  async dateSet(db) {
    const rows = await db.getAllAsync('SELECT holiday_date FROM public_holiday WHERE deleted_at IS NULL');
    return new Set(rows.map((row) => row.holiday_date));
  },

  // Adds a date and returns its id. A date already in the list is not an
  // error (the Park toggle may add it again); it keeps its row and gains the
  // name if it had none. Takes the connection it is given and opens no
  // transaction, so sessions.start can call it inside its own.
  async add(db, { holiday_date, name = null }) {
    const date = String(holiday_date ?? '').trim();
    if (!isDateKey(date)) throw new Error('Enter the date as YYYY-MM-DD, such as 2026-12-25.');
    const label = String(name ?? '').trim() || null;
    const current = await db.getFirstAsync(
      'SELECT id, name FROM public_holiday WHERE holiday_date = ? AND deleted_at IS NULL',
      [date]
    );
    if (!current) return base.create(db, { holiday_date: date, name: label });
    if (label && !current.name) await base.update(db, current.id, { name: label });
    return current.id;
  },
};
