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

// True for a real calendar day written as 'YYYY-MM-DD' ('2026-02-30' is not).
export function isDateKey(text) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(text ?? ''));
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const d = new Date(year, month - 1, day);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
}

// 'Fri, 25 Dec 2026' for a 'YYYY-MM-DD' key, such as a public holiday date.
export function formatDateKey(key) {
  if (!isDateKey(key)) throw new Error(`Not a date: ${key}`);
  const [year, month, day] = key.split('-').map(Number);
  return formatDate(new Date(year, month - 1, day).getTime());
}

// Local calendar month as 'YYYY-MM'. Spending counts a session in the month it started.
export function localMonthKey(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

function parseMonthKey(key) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(key ?? ''));
  const month = match ? Number(match[2]) : 0;
  if (month < 1 || month > 12) throw new Error(`Not a month: ${key}`);
  return { year: Number(match[1]), monthIndex: month - 1 };
}

// The month n months after key (n may be negative): addMonths('2026-01', -1) -> '2025-12'.
export function addMonths(key, n) {
  const { year, monthIndex } = parseMonthKey(key);
  return localMonthKey(new Date(year, monthIndex + n, 1).getTime());
}

// { start, end } in epoch ms: local midnight on the 1st, and on the 1st of the next month.
export function monthRange(key) {
  const { year, monthIndex } = parseMonthKey(key);
  return { start: new Date(year, monthIndex, 1).getTime(), end: new Date(year, monthIndex + 1, 1).getTime() };
}

// 'Oct 2026'
export function formatMonth(key) {
  const { year, monthIndex } = parseMonthKey(key);
  return `${MONTHS[monthIndex]} ${year}`;
}

// 'Oct', for chart labels.
export function formatMonthShort(key) {
  return MONTHS[parseMonthKey(key).monthIndex];
}

// '30 min', '1 hour', '2 hours': a whole number of minutes, as on the timer
// chips and in rate summaries.
export function formatMinutes(minutes) {
  if (minutes % 60 !== 0) return `${minutes} min`;
  const hours = minutes / 60;
  return hours === 1 ? '1 hour' : `${hours} hours`;
}

// '0h 05m', '26h 30m'. Rounds down to the whole minute.
export function formatDuration(ms) {
  if (!(ms >= 0)) throw new Error(`Duration must be zero or more, got ${ms}`);
  const totalMinutes = Math.floor(ms / 60000);
  return `${Math.floor(totalMinutes / 60)}h ${pad2(totalMinutes % 60)}m`;
}
