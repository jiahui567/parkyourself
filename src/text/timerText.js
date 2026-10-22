import { formatDuration, formatTime } from '../lib/time';

const MINUTE = 60 * 1000;

// 'Timer ends 4:15 PM · 0h 25m left', 'Timer ended at 4:15 PM', or null with
// no timer. The time left is rounded up to the minute so the last minute
// reads '0h 01m left', not '0h 00m left'.
export function timerStatusText(timerEndsAt, nowMs) {
  if (timerEndsAt == null) return null;
  if (timerEndsAt <= nowMs) return `Timer ended at ${formatTime(timerEndsAt)}`;
  const leftMs = Math.ceil((timerEndsAt - nowMs) / MINUTE) * MINUTE;
  return `Timer ends ${formatTime(timerEndsAt)} · ${formatDuration(leftMs)} left`;
}
