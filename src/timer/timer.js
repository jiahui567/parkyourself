// Parking timer rules (PLAN.md, "Notifications"). Pure functions: the screens
// and, from M3, the reminders use them; nothing here schedules anything.
// Times are epoch milliseconds, lengths are whole minutes.

const MINUTE = 60 * 1000;

// Settings choices. The defaults are the ones PLAN.md promises.
// Timer when parking: 0 is Off, the default (M9, 2026-10-24).
export const DEFAULT_PARK_TIMER_MINUTES = 0;

// The timer wheel (M10): hours 0 to 23 and minutes in 5-minute steps.
export const TIMER_STEP_MINUTES = 5;
export const MAX_TIMER_HOURS = 23;
export const MAX_TIMER_MINUTES = MAX_TIMER_HOURS * 60 + 60 - TIMER_STEP_MINUTES;

// A length the wheel can show: whole 5-minute steps from 0 (Off) up to 23 h 55 m.
export function isTimerLength(minutes) {
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > MAX_TIMER_MINUTES) return false;
  return minutes % TIMER_STEP_MINUTES === 0;
}

// Where Find's timer wheel starts: the time left on a running timer, rounded
// up to the wheel's step; otherwise the length set in Settings, or 1 hour
// when that is Off.
export function wheelStartMinutes(timerEndsAt, nowMs, parkTimerMinutes) {
  if (timerEndsAt != null && timerEndsAt > nowMs) {
    const steps = Math.ceil((timerEndsAt - nowMs) / (TIMER_STEP_MINUTES * MINUTE));
    return Math.min(steps * TIMER_STEP_MINUTES, MAX_TIMER_MINUTES);
  }
  return parkTimerMinutes > 0 ? parkTimerMinutes : 60;
}

// 150 -> { hours: 2, minutes: 30 }, for the wheel's two columns.
export function splitMinutes(total) {
  return { hours: Math.floor(total / 60), minutes: total % 60 };
}
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

// The timer end for a park that starts at startMs with Timer when parking set
// to minutes, or null when it is Off (0).
export function parkTimerEnd(startMs, minutes) {
  return minutes === 0 ? null : timerEndFrom(startMs, minutes);
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
