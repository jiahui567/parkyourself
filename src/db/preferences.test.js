import { openMigratedTestDatabase } from '../../test/testDatabase';
import { preferences } from './preferences';
import { settings } from './settings';

let db;
beforeEach(async () => {
  db = await openMigratedTestDatabase();
});
afterEach(() => db.close());

describe('preferences.get', () => {
  it('gives the defaults when nothing is saved', async () => {
    expect(await preferences.get(db)).toEqual({ extendMinutes: 30, reminderLeadMinutes: 10 });
  });

  it('reads back the saved choices', async () => {
    await preferences.setExtendMinutes(db, 60);
    await preferences.setReminderLeadMinutes(db, 15);

    expect(await preferences.get(db)).toEqual({ extendMinutes: 60, reminderLeadMinutes: 15 });
  });

  it('falls back to the default for a stored value that is no longer a choice', async () => {
    await settings.set(db, 'extend_minutes', '45');
    await settings.set(db, 'reminder_lead_minutes', '45');

    expect(await preferences.get(db)).toEqual({ extendMinutes: 30, reminderLeadMinutes: 10 });
  });
});

describe('preferences setters', () => {
  it.each([
    ['setExtendMinutes', 45, 'extend_minutes', 'Extend timer by must be one of 15, 30, 60 minutes'],
    ['setExtendMinutes', '30', 'extend_minutes', 'Extend timer by must be one of 15, 30, 60 minutes'],
    [
      'setReminderLeadMinutes',
      20,
      'reminder_lead_minutes',
      'Reminder lead time must be one of 5, 10, 15, 30 minutes',
    ],
  ])('%s rejects %p and saves nothing', async (setter, minutes, key, message) => {
    await expect(preferences[setter](db, minutes)).rejects.toThrow(message);

    expect(await settings.get(db, key)).toBeNull();
  });
});
