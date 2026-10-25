import { assertValidRate, DAY_TYPES, feeFields } from '../fees';
import { formatRM } from '../lib/money';
import { formatMinutes, parseServerTime } from '../lib/time';
import { dayTypeLabel } from '../text/rateText';

// Rate reports (PLAN.md, C10): what a report may hold. The same rules as the
// server's report_rate_is_valid (supabase/migrations/*_rate_reports.sql), so
// the phone refuses a report before sending it, and leaves out a downloaded
// one it cannot show.

// A day, and RM 1,000: anything longer or dearer is a typing mistake or spam,
// and pending reports show to every user before anyone has checked them.
export const MAX_REPORT_MINUTES = 1440;
export const MAX_REPORT_SEN = 100000;

const MINUTE_FIELDS = ['first_minutes', 'block_minutes', 'grace_minutes'];
const SEN_FIELDS = ['first_sen', 'block_sen', 'flat_sen', 'daily_cap_sen'];

// The problem with one day type's rate, as a sentence, or null.
function rateProblem(dayType, rate) {
  if (dayType === 'holiday' && rate?.type !== 'flat') return 'A public holiday amount must be a flat price per entry.';
  try {
    assertValidRate(rate);
  } catch (e) {
    return e.message;
  }
  if (MINUTE_FIELDS.some((field) => rate[field] != null && rate[field] > MAX_REPORT_MINUTES)) {
    return `A period can be at most ${formatMinutes(MAX_REPORT_MINUTES)}.`;
  }
  if (SEN_FIELDS.some((field) => rate[field] != null && rate[field] > MAX_REPORT_SEN)) {
    return `An amount can be at most ${formatRM(MAX_REPORT_SEN)}.`;
  }
  return null;
}

// The rates a report sends, from { weekday, weekend, holiday } (each a rate
// or null): { rates, error }. rates has every day type, each the fee fields
// or null; error is the first problem, in the order the form shows the rates,
// and rates is null with it.
export function reportRatesFrom(rates) {
  const sent = {};
  for (const dayType of DAY_TYPES) {
    const rate = rates?.[dayType] ?? null;
    const problem = rate && rateProblem(dayType, rate);
    if (problem) return { rates: null, error: `${dayTypeLabel(dayType)} rate: ${problem}` };
    sent[dayType] = feeFields(rate);
  }
  if (DAY_TYPES.every((dayType) => !sent[dayType])) return { rates: null, error: 'Fill in at least one rate to report.' };
  return { rates: sent, error: null };
}

// The pending reports of the daily download, as the phone stores them:
// [{ id, car_park_id, rates, reported_at }]. The server checks every report,
// but one the phone cannot read is left out rather than shown wrong.
export function readPendingReports(rows) {
  const reports = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    const reportedAt = parseServerTime(row?.created_at);
    if (typeof row?.id !== 'string' || typeof row.car_park_id !== 'string' || !Number.isFinite(reportedAt)) continue;
    const { rates, error } = reportRatesFrom(row.rates);
    if (!error) reports.push({ id: row.id, car_park_id: row.car_park_id, rates, reported_at: reportedAt });
  }
  return reports;
}
