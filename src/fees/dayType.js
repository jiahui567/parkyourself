import { localDateKey } from '../lib/time';

// 'weekday', 'weekend' or 'holiday' for the local calendar day containing ms.
// holidayDates is a Set of 'YYYY-MM-DD' strings from public_holiday. A public
// holiday wins even when it falls on a weekend.
export function dayTypeOf(ms, holidayDates = new Set()) {
  if (holidayDates.has(localDateKey(ms))) return 'holiday';
  const day = new Date(ms).getDay();
  return day === 0 || day === 6 ? 'weekend' : 'weekday';
}
