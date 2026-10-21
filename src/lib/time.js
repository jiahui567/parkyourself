// Times are stored as UTC epoch milliseconds and shown in the phone's local
// time. Text is built by hand instead of with Intl so it is the same on the
// phone (Hermes) and in tests (Node).

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const pad2 = (n) => String(n).padStart(2, '0');

// Local calendar day as 'YYYY-MM-DD', the format of public_holiday.holiday_date.
export function localDateKey(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

// The first local midnight after ms (the next day's midnight if ms is midnight).
export function nextLocalMidnight(ms) {
  const d = new Date(ms);
  d.setHours(24, 0, 0, 0);
  return d.getTime();
}

// '2:15 PM'
export function formatTime(ms) {
  const d = new Date(ms);
  const hours = d.getHours();
  return `${hours % 12 || 12}:${pad2(d.getMinutes())} ${hours < 12 ? 'AM' : 'PM'}`;
}

// 'Fri, 23 Oct 2026'
export function formatDate(ms) {
  const d = new Date(ms);
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

// '0h 05m', '26h 30m'. Rounds down to the whole minute.
export function formatDuration(ms) {
  if (!(ms >= 0)) throw new Error(`Duration must be zero or more, got ${ms}`);
  const totalMinutes = Math.floor(ms / 60000);
  return `${Math.floor(totalMinutes / 60)}h ${pad2(totalMinutes % 60)}m`;
}
