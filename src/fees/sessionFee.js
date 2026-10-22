import { calcStayFee } from './calcFee';
import { DAY_TYPES, feeFields } from './rateForm';

// A session keeps a copy of the rates it used (rate_snapshot), so changing a
// place's rate later never changes a past fee.

// rates with only the day types that have a rate.
function presentRates(rates) {
  const present = {};
  for (const dayType of DAY_TYPES) {
    if (rates?.[dayType]) present[dayType] = rates[dayType];
  }
  return present;
}

// base with each rate in top replacing base's rate for that day type. Used
// for the snapshot (saved rates, then the ones typed on Park) and for a
// missing rate typed when ending.
export function mergeRates(base, top) {
  return { ...presentRates(base), ...presentRates(top) };
}

// The rate_snapshot JSON: { weekday?, weekend?, holiday? } with fee fields
// only. null when there is no rate at all.
export function snapshotText(rates) {
  const present = presentRates(rates);
  if (Object.keys(present).length === 0) return null;
  const snapshot = {};
  for (const [dayType, rate] of Object.entries(present)) snapshot[dayType] = feeFields(rate);
  return JSON.stringify(snapshot);
}

// The rates in a rate_snapshot, or null when the session has none.
export function ratesFromSnapshot(text) {
  if (text == null || text === '') return null;
  const rates = presentRates(JSON.parse(text));
  return Object.keys(rates).length > 0 ? rates : null;
}

// The fee for a session ending at endMs, from its rate snapshot. extraRates
// ({ weekend: rate }) fill in a rate the snapshot is missing, for the preview
// while the user types it. Returns calcStayFee's result, or null when the
// session has no rates (no place, or no rate entered).
export function sessionFee(session, endMs, holidayDates, extraRates = null) {
  const rates = mergeRates(ratesFromSnapshot(session.rate_snapshot), extraRates);
  if (Object.keys(rates).length === 0) return null;
  return calcStayFee(session.started_at, endMs, rates, holidayDates);
}
