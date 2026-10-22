import {
  DEFAULT_EXTEND_MINUTES,
  DEFAULT_REMINDER_LEAD_MINUTES,
  EXTEND_OPTIONS,
  REMINDER_LEAD_OPTIONS,
} from '../timer/timer';
import { settings } from './settings';

// Timer preferences, kept in the local-only setting table as text.
const EXTEND = {
  key: 'extend_minutes',
  label: 'Extend timer by',
  options: EXTEND_OPTIONS,
  fallback: DEFAULT_EXTEND_MINUTES,
};
const REMINDER_LEAD = {
  key: 'reminder_lead_minutes',
  label: 'Reminder lead time',
  options: REMINDER_LEAD_OPTIONS,
  fallback: DEFAULT_REMINDER_LEAD_MINUTES,
};

// A value saved by an older version that is no longer a choice falls back to
// the default instead of breaking the timer.
async function readMinutes(db, preference) {
  const minutes = Number(await settings.get(db, preference.key));
  return preference.options.includes(minutes) ? minutes : preference.fallback;
}

async function writeMinutes(db, preference, minutes) {
  if (!preference.options.includes(minutes)) {
    const choices = preference.options.join(', ');
    throw new Error(`${preference.label} must be one of ${choices} minutes, got ${minutes}.`);
  }
  await settings.set(db, preference.key, String(minutes));
}

export const preferences = {
  async get(db) {
    return {
      extendMinutes: await readMinutes(db, EXTEND),
      reminderLeadMinutes: await readMinutes(db, REMINDER_LEAD),
    };
  },

  setExtendMinutes: (db, minutes) => writeMinutes(db, EXTEND, minutes),

  setReminderLeadMinutes: (db, minutes) => writeMinutes(db, REMINDER_LEAD, minutes),
};
