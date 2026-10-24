import { openMigratedTestDatabase } from '../../test/testDatabase';
import { preferences } from './preferences';
import { settings } from './settings';

let db;
beforeEach(async () => {
  db = await openMigratedTestDatabase();
});
afterEach(() => db.close());

const DEFAULTS = { extendMinutes: 30, reminderLeadMinutes: 10, parkTimerMinutes: 0, useLocation: true };

describe('preferences.get', () => {
  it('gives the defaults when nothing is saved', async () => {
    expect(await preferences.get(db)).toEqual(DEFAULTS);
  });

  it('reads back the saved choices', async () => {
    await preferences.setExtendMinutes(db, 60);
    await preferences.setReminderLeadMinutes(db, 15);
    await preferences.setParkTimerMinutes(db, 150);
    await preferences.setUseLocation(db, false);

    expect(await preferences.get(db)).toEqual({
      extendMinutes: 60,
      reminderLeadMinutes: 15,
      parkTimerMinutes: 150,
      useLocation: false,
    });
  });

  it('keeps Off as a timer choice', async () => {
    await preferences.setParkTimerMinutes(db, 60);
    await preferences.setParkTimerMinutes(db, 0);

    expect((await preferences.get(db)).parkTimerMinutes).toBe(0);
  });

  it('turns the location back on', async () => {
    await preferences.setUseLocation(db, false);
    await preferences.setUseLocation(db, true);

    expect((await preferences.get(db)).useLocation).toBe(true);
  });

  it('falls back to the default for a stored value that is no longer a choice', async () => {
    await settings.set(db, 'extend_minutes', '45');
    await settings.set(db, 'reminder_lead_minutes', '45');
    await settings.set(db, 'park_timer_minutes', '47');

    expect(await preferences.get(db)).toEqual(DEFAULTS);
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
    ['setParkTimerMinutes', 47, 'park_timer_minutes', 'Timer when parking must be 0 to 1435 minutes in 5-minute steps'],
    ['setParkTimerMinutes', 24 * 60, 'park_timer_minutes', 'Timer when parking must be 0 to 1435 minutes'],
    ['setUseLocation', 'on', 'use_location', 'Use location must be true or false'],
  ])('%s rejects %p and saves nothing', async (setter, value, key, message) => {
    await expect(preferences[setter](db, value)).rejects.toThrow(message);

    expect(await settings.get(db, key)).toBeNull();
  });
});
