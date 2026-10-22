import { formatRM } from '../lib/money';
import { formatMinutes } from '../lib/time';

// Text for saved rates, shared by Park, Places and the end-of-session summary.

const DAY_TYPE_LABELS = { weekday: 'Weekday', weekend: 'Weekend', holiday: 'Public holiday' };

// The rate a missing day type borrowed (calcStayFee's missingRates).
const BORROWED_FROM = { weekday: 'weekend', weekend: 'weekday' };

export function dayTypeLabel(dayType) {
  const label = DAY_TYPE_LABELS[dayType];
  if (!label) throw new Error(`Unknown day type: ${dayType}`);
  return label;
}

// One hour reads 'first hour' and 'per hour', not 'first 1 hour'.
const periodText = (minutes) => (minutes === 60 ? 'hour' : formatMinutes(minutes));

// RateForm's price labels follow the period lengths typed: 'First hour (RM)',
// 'First 30 min (RM)', 'Each hour after (RM)', 'Each 2 hours after (RM)'.
// Minutes that are not a whole number yet read as 'period'.
const typedPeriodText = (typed) => {
  const trimmed = String(typed ?? '').trim();
  return /^\d+$/.test(trimmed) && Number(trimmed) > 0 ? periodText(Number(trimmed)) : 'period';
};

export function firstPriceLabel(firstMinutes) {
  return `First ${typedPeriodText(firstMinutes)} (RM)`;
}

export function blockPriceLabel(blockMinutes) {
  return `Each ${typedPeriodText(blockMinutes)} after (RM)`;
}

// 'RM 3.00 first hour, then RM 2.00 per hour · 15 min free · max RM 20.00 a day',
// 'RM 5.00 per entry', or null for no rate.
export function rateSummary(rate) {
  if (!rate) return null;
  const price =
    rate.type === 'flat'
      ? `${formatRM(rate.flat_sen)} per entry`
      : `${formatRM(rate.first_sen)} first ${periodText(rate.first_minutes)}, ` +
        `then ${formatRM(rate.block_sen)} per ${periodText(rate.block_minutes)}`;
  return [
    price,
    rate.grace_minutes > 0 && `${formatMinutes(rate.grace_minutes)} free`,
    rate.daily_cap_sen != null && `max ${formatRM(rate.daily_cap_sen)} a day`,
  ]
    .filter(Boolean)
    .join(' · ');
}

// 'Estimate uses the weekday rate' when a stay ran into a day type with no
// saved rate (calcStayFee result), otherwise null. Only for an estimate: a
// free stay within the grace period borrows a rate too, but costs nothing.
export function missingRateText(fee) {
  const missing = fee?.isEstimate ? fee.missingRates?.[0] : null;
  return missing ? `Estimate uses the ${BORROWED_FROM[missing]} rate` : null;
}
