// Parking timer rules (PLAN.md, "Notifications"). Pure functions: the screens
// and, from M3, the reminders use them; nothing here schedules anything.
// Times are epoch milliseconds, lengths are whole minutes.

const MINUTE = 60 * 1000;

// Chips on Park.
export const TIMER_OPTIONS = [30, 60, 120, 180, 240];

// Settings choices. The defaults are the ones PLAN.md promises.
export const EXTEND_OPTIONS = [15, 30, 60];
export const DEFAULT_EXTEND_MINUTES = 30;
export const REMINDER_LEAD_OPTIONS = [5, 10, 15, 30];
export const DEFAULT_REMINDER_LEAD_MINUTES = 10;

// A bad length would be saved as a wrong timer_ends_at, so it fails loudly here.
function assertMinutes(minutes) {
  if (!Number.isInteger(minutes) || minutes <= 0) {
    throw new Error(`Timer minutes must be a whole number above 0, got ${minutes}`);
  }
}

export function timerEndFrom(startMs, minutes) {
  assertMinutes(minutes);
  return startMs + minutes * MINUTE;
}

// Extending an expired timer counts from now, so the user always gets the full
// extra time. With no timer yet, it starts one.
export function extendTimer(timerEndsAt, nowMs, minutes) {
  assertMinutes(minutes);
  const from = timerEndsAt == null ? nowMs : Math.max(timerEndsAt, nowMs);
  return from + minutes * MINUTE;
}

// The reminders still to come, earliest first: lead minutes before the end
// ('before') and at the end ('end'). A reminder already due is left out, so
// rescheduling after Extend never fires one straight away.
export function reminderTimes(timerEndsAt, leadMinutes, nowMs) {
  assertMinutes(leadMinutes);
  if (timerEndsAt == null) return [];
  return [
    { kind: 'before', at: timerEndsAt - leadMinutes * MINUTE },
    { kind: 'end', at: timerEndsAt },
  ].filter((reminder) => reminder.at > nowMs);
}
