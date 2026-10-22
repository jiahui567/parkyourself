import { addMonths, localMonthKey, monthRange } from '../lib/time';
import { monthSummary, monthlyTotals } from './summary';

// Which months the Spending tab shows: the chosen month, and the 12 months of
// the bar chart. Month keys are 'YYYY-MM', so they compare as text.

export const CHART_MONTHS = 12;

// The last month of the chart after the user picks selected. The chart keeps
// its months while the pick is one of them, so tapping a bar never slides the
// bars under the finger; it moves only as far as needed to show the pick.
export function chartWindowEnd(selected, end, count = CHART_MONTHS) {
  if (selected > end) return selected;
  if (selected < addMonths(end, 1 - count)) return addMonths(selected, count - 1);
  return end;
}

// { from, to } in epoch ms for sessions.listHistory: the chart's months ending at end.
export function chartRange(end, count = CHART_MONTHS) {
  return { from: monthRange(addMonths(end, 1 - count)).start, to: monthRange(end).end };
}

// True while there is a later month to go to; the future has no spending.
export function hasNextMonth(month, currentMonth) {
  return month < currentMonth;
}

const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/;

// The month History asks Spending to show (?month=YYYY-MM), or null when the
// link has none, a malformed one, or a future month.
export function requestedMonth(param, currentMonth) {
  return typeof param === 'string' && MONTH_KEY.test(param) && param <= currentMonth ? param : null;
}

// The totals for month and the chart bars ending at end, from the rows of
// chartRange(end). monthSummary does not filter by month, so this does.
export function spendingView(rows, month, end) {
  return {
    summary: monthSummary(rows.filter((row) => localMonthKey(row.started_at) === month)),
    totals: monthlyTotals(rows, end),
  };
}
