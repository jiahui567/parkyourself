import { localDateKey, nextLocalMidnight } from '../lib/time';
import { dayTypeOf } from './dayType';

// A rate is a place_rate row (or the same shape from rate_snapshot):
// { type, first_minutes, first_sen, block_minutes, block_sen, grace_minutes,
//   daily_cap_sen, flat_sen }. Money is in sen, durations in milliseconds.

const MINUTE = 60 * 1000;

// Which other day type's rate to borrow when one is missing.
const BORROW_FROM = { weekday: 'weekend', weekend: 'weekday' };

const isCount = (v) => Number.isInteger(v) && v >= 0;
const isPositive = (v) => Number.isInteger(v) && v > 0;

// Throws if a rate is missing a field its type needs. A daily cap of 0 is
// rejected rather than read as "free", so a bad save cannot zero every fee.
export function assertValidRate(rate) {
  if (rate?.type !== 'hourly' && rate?.type !== 'flat') {
    throw new Error(`Unknown rate type: ${rate?.type}`);
  }
  const bad = (field) => new Error(`Invalid ${rate.type} rate: ${field} is ${rate[field]}`);
  if (rate.grace_minutes != null && !isCount(rate.grace_minutes)) throw bad('grace_minutes');
  if (rate.daily_cap_sen != null && !isPositive(rate.daily_cap_sen)) throw bad('daily_cap_sen');
  if (rate.type === 'flat') {
    if (!isCount(rate.flat_sen)) throw bad('flat_sen');
    return;
  }
  for (const field of ['first_minutes', 'block_minutes']) {
    if (!isPositive(rate[field])) throw bad(field);
  }
  for (const field of ['first_sen', 'block_sen']) {
    if (!isCount(rate[field])) throw bad(field);
  }
}

function uncappedDayFeeSen(durationMs, rate) {
  if (rate.type === 'flat') return rate.flat_sen;
  const remainingMs = durationMs - rate.first_minutes * MINUTE;
  if (remainingMs <= 0) return rate.first_sen;
  // A started block is charged in full ("per hour or part thereof").
  return rate.first_sen + Math.ceil(remainingMs / (rate.block_minutes * MINUTE)) * rate.block_sen;
}

const capSen = (fee, rate) => (rate.daily_cap_sen != null ? Math.min(fee, rate.daily_cap_sen) : fee);

// Fee for one calendar day's part of a stay, with the daily cap applied.
export function calcDayFeeSen(durationMs, rate) {
  assertValidRate(rate);
  return capSen(uncappedDayFeeSen(durationMs, rate), rate);
}

// The rate for a day type. A missing holiday amount uses the weekend rate by
// design. Any other missing rate borrows the other day type's rate, and the
// fee becomes an estimate. Returns null when neither rate exists.
function pickRate(rates, dayType) {
  if (dayType === 'holiday' && rates.holiday) {
    return { rate: rates.holiday, rateDayType: 'holiday', missing: null };
  }
  const wanted = dayType === 'holiday' ? 'weekend' : dayType;
  if (rates[wanted]) return { rate: rates[wanted], rateDayType: wanted, missing: null };
  const other = BORROW_FROM[wanted];
  if (rates[other]) return { rate: rates[other], rateDayType: other, missing: wanted };
  return null;
}

// Splits a stay at each local midnight. A stay that ends exactly at midnight
// has no part on the next day.
function splitByLocalDay(startMs, endMs) {
  const parts = [];
  let start = startMs;
  do {
    const end = Math.min(nextLocalMidnight(start), endMs);
    parts.push({ start, end });
    start = end;
  } while (start < endMs);
  return parts;
}

// Fee for a whole stay. rates is { weekday, weekend, holiday }, each a rate or
// missing; holidayDates is a Set of 'YYYY-MM-DD'. Returns:
//   feeSen        total in sen, or null when the place has no usable rate
//   isEstimate    the stay crosses midnight, or a missing rate was borrowed
//   overnight     the stay crosses local midnight
//   withinGrace   free: the whole stay fits in the first day's grace period
//   missingRates  day types that borrowed another day type's rate
//   days          per calendar day: { date, dayType, rateDayType, durationMs, feeSen, capped }
export function calcStayFee(startMs, endMs, rates, holidayDates = new Set()) {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    throw new Error(`Stay times must be epoch milliseconds, got ${startMs} and ${endMs}`);
  }
  if (endMs < startMs) throw new Error('A stay cannot end before it starts');

  const parts = splitByLocalDay(startMs, endMs);
  const overnight = parts.length > 1;
  const missingRates = [];
  const picked = [];
  for (const part of parts) {
    const dayType = dayTypeOf(part.start, holidayDates);
    const choice = pickRate(rates, dayType);
    if (!choice) {
      return {
        feeSen: null,
        isEstimate: false,
        overnight,
        withinGrace: false,
        missingRates: ['weekday', 'weekend'],
        days: [],
      };
    }
    assertValidRate(choice.rate);
    if (choice.missing && !missingRates.includes(choice.missing)) missingRates.push(choice.missing);
    picked.push({ ...part, dayType, ...choice });
  }

  const graceMs = (picked[0].rate.grace_minutes ?? 0) * MINUTE;
  const withinGrace = endMs - startMs <= graceMs;

  const days = picked.map(({ start, end, dayType, rate, rateDayType }) => {
    const uncapped = withinGrace ? 0 : uncappedDayFeeSen(end - start, rate);
    const feeSen = capSen(uncapped, rate);
    return {
      date: localDateKey(start),
      dayType,
      rateDayType,
      durationMs: end - start,
      feeSen,
      capped: feeSen < uncapped,
    };
  });

  return {
    feeSen: days.reduce((sum, day) => sum + day.feeSen, 0),
    isEstimate: !withinGrace && (overnight || missingRates.length > 0),
    overnight,
    withinGrace,
    missingRates,
    days,
  };
}
