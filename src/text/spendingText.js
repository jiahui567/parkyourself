import { formatRM } from '../lib/money';
import { formatDuration, formatMonth } from '../lib/time';
import { amountSen } from '../spending/summary';

// Text for the Spending tab, the sessions list it opens and the History cards.

// '1 session', '3 sessions'
export function sessionCountText(count) {
  return count === 1 ? '1 session' : `${count} sessions`;
}

// '3 sessions · 4h 30m parked', under the month's total.
export function monthStatsText({ sessions, durationMs }) {
  return `${sessionCountText(sessions)} · ${formatDuration(durationMs)} parked`;
}

// 'RM 45.00 · 3 sessions', the total of a list of sessions.
export function totalLineText({ totalSen, sessions }) {
  return `${formatRM(totalSen)} · ${sessionCountText(sessions)}`;
}

// A byPlace group's name; sessions with no place are grouped under id null.
export function placeLabel(group) {
  return group.id == null ? 'No place' : group.name;
}

// 'No parking in Oct 2026.'
export function emptyMonthText(monthKey) {
  return `No parking in ${formatMonth(monthKey)}.`;
}

// 'No parking here in Oct 2026.', for an empty sessions list.
export function noSessionsText(monthKey) {
  return `No parking here in ${formatMonth(monthKey)}.`;
}

// 'Nov 2025 to Oct 2026', for monthlyTotals (oldest first).
export function chartRangeText(totals) {
  return `${formatMonth(totals[0].key)} to ${formatMonth(totals[totals.length - 1].key)}`;
}

// What a screen reader says for the bar chart, which it cannot see:
// 'Spending by month, Nov 2025 to Oct 2026. Total RM 120.00. Highest: Mar 2026, RM 30.00.'
export function chartSummaryText(totals) {
  const range = `Spending by month, ${chartRangeText(totals)}.`;
  const sessions = totals.reduce((sum, month) => sum + month.sessions, 0);
  if (sessions === 0) return `${range} No parking.`;
  const totalSen = totals.reduce((sum, month) => sum + month.totalSen, 0);
  if (totalSen === 0) return `${range} Total ${formatRM(0)}.`;
  // The first of equal months, so the sentence does not change between loads.
  const highest = totals.reduce((best, month) => (month.totalSen > best.totalSen ? month : best));
  return `${range} Total ${formatRM(totalSen)}. Highest: ${formatMonth(highest.key)}, ${formatRM(highest.totalSen)}.`;
}

// The amount on a History card, or null when the session has neither a
// calculated fee nor an amount paid (no rate was known).
export function amountText(session) {
  if (session.fee_sen == null && session.paid_sen == null) return null;
  return formatRM(amountSen(session));
}
