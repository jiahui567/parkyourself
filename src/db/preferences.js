import {
  DEFAULT_EXTEND_MINUTES,
  DEFAULT_PARK_TIMER_MINUTES,
  DEFAULT_REMINDER_LEAD_MINUTES,
  EXTEND_OPTIONS,
  isTimerLength,
  REMINDER_LEAD_OPTIONS,
} from '../timer/timer';
import { settings } from './settings';

// Timer and location preferences, kept in the local-only setting table as text.
const choiceOf = (options) => ({
  allows: (minutes) => options.includes(minutes),
  rule: `one of ${options.join(', ')} minutes`,
});
const EXTEND = {
  key: 'extend_minutes',
  label: 'Extend timer by',
  ...choiceOf(EXTEND_OPTIONS),
  fallback: DEFAULT_EXTEND_MINUTES,
};
const REMINDER_LEAD = {
  key: 'reminder_lead_minutes',
  label: 'Reminder lead time',
  ...choiceOf(REMINDER_LEAD_OPTIONS),
  fallback: DEFAULT_REMINDER_LEAD_MINUTES,
};
// Any length the timer wheel shows; 0 is Off.
const PARK_TIMER = {
  key: 'park_timer_minutes',
  label: 'Timer when parking',
  allows: isTimerLength,
  rule: '0 to 1435 minutes in 5-minute steps',
  fallback: DEFAULT_PARK_TIMER_MINUTES,
};
// 'on' or 'off'. On until switched off: it only reads anything once Android's
// permission is allowed too, and before M9 an allowed location was always used.
const USE_LOCATION_KEY = 'use_location';

// A value saved by an older version that is no longer a choice falls back to
// the default instead of breaking the timer.
async function readMinutes(db, preference) {
  const minutes = Number(await settings.get(db, preference.key));
  return preference.allows(minutes) ? minutes : preference.fallback;
}

async function writeMinutes(db, preference, minutes) {
  if (!preference.allows(minutes)) {
    throw new Error(`${preference.label} must be ${preference.rule}, got ${minutes}.`);
  }
  await settings.set(db, preference.key, String(minutes));
}

export const preferences = {
  async get(db) {
    return {
      extendMinutes: await readMinutes(db, EXTEND),
      reminderLeadMinutes: await readMinutes(db, REMINDER_LEAD),
      parkTimerMinutes: await readMinutes(db, PARK_TIMER),
      useLocation: (await settings.get(db, USE_LOCATION_KEY)) !== 'off',
    };
  },

  setExtendMinutes: (db, minutes) => writeMinutes(db, EXTEND, minutes),

  setReminderLeadMinutes: (db, minutes) => writeMinutes(db, REMINDER_LEAD, minutes),

  setParkTimerMinutes: (db, minutes) => writeMinutes(db, PARK_TIMER, minutes),

  async setUseLocation(db, on) {
    if (typeof on !== 'boolean') throw new Error(`Use location must be true or false, got ${on}.`);
    await settings.set(db, USE_LOCATION_KEY, on ? 'on' : 'off');
  },
};
