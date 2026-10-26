import { formatDateKey } from '../lib/time';
import { dayTypeLabel, rateSummary } from './rateText';

// Text for a listed car park's view-only page, opened from the car park list
// on Places (2026-10-26).

// One row per day type, the label then the rate in effect:
// [{ dayType: 'weekday', label: 'Weekday', value: 'RM 3.00 first hour, then RM 2.00 per hour' }, ...].
// A public holiday with no amount of its own is charged at the weekend rate.
export function carParkRateRows(rates) {
  const holiday = rates?.holiday ? rateSummary(rates.holiday) : rates?.weekend ? 'Weekend rate' : null;
  return [
    { dayType: 'weekday', value: rateSummary(rates?.weekday) },
    { dayType: 'weekend', value: rateSummary(rates?.weekend) },
    { dayType: 'holiday', value: holiday },
  ].map((row) => ({ ...row, label: dayTypeLabel(row.dayType), value: row.value ?? 'Not on the list' }));
}

// Under the rates: how old they are, and that the sign has the last word.
// 'Checked Sat, 24 Oct 2026, in effect since Mon, 1 Jan 2024. Check the sign at the car park.'
export function carParkCheckedText({ checked_on, effective_from }) {
  const since = effective_from ? `, in effect since ${formatDateKey(effective_from)}` : '';
  return `Checked ${formatDateKey(checked_on)}${since}. Check the sign at the car park.`;
}

// Places with a search that matches nothing, saved or listed.
export function noPlaceMatchesText(query) {
  return `Nothing matches "${String(query ?? '').trim()}".`;
}
