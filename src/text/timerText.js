import { formatDuration, formatMinutes, formatTime, localDateKey } from '../lib/time';

const MINUTE = 60 * 1000;

// A timer length from the wheel: 'Off' for 0, '45 min', '2 hours', '2h 30m'.
export function parkTimerText(minutes) {
  if (minutes === 0) return 'Off';
  if (minutes < 60 || minutes % 60 === 0) return formatMinutes(minutes);
  return formatDuration(minutes * MINUTE);
}

// Under the wheel on Find: when a timer of this length set now would end.
// The wheel stops at 23 h 55 m, so the end is today or tomorrow.
export function timerWouldEndText(nowMs, minutes) {
  if (minutes === 0) return 'Pick how long';
  const end = nowMs + minutes * MINUTE;
  const day = localDateKey(end) === localDateKey(nowMs) ? '' : 'tomorrow ';
  return `Ends ${day}${formatTime(end)}`;
}

// 'Timer ends 4:15 PM · 0h 25m left', 'Timer ended at 4:15 PM', or null with
// no timer. The time left is rounded up to the minute so the last minute
// reads '0h 01m left', not '0h 00m left'.
export function timerStatusText(timerEndsAt, nowMs) {
  if (timerEndsAt == null) return null;
  if (timerEndsAt <= nowMs) return `Timer ended at ${formatTime(timerEndsAt)}`;
  const leftMs = Math.ceil((timerEndsAt - nowMs) / MINUTE) * MINUTE;
  return `Timer ends ${formatTime(timerEndsAt)} · ${formatDuration(leftMs)} left`;
}
