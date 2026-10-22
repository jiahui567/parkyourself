import { formatAmountInput, parseRM } from '../lib/money';

// Turns what the user types into a rate (and back), and decides which typed
// rates Park saves to the place (PLAN.md, "Saved places and rates").

export const DAY_TYPES = ['weekday', 'weekend', 'holiday'];

// The columns of place_rate that decide a fee. rate_snapshot stores only these.
const FEE_FIELDS = [
  'type', 'first_minutes', 'first_sen', 'block_minutes', 'block_sen',
  'grace_minutes', 'daily_cap_sen', 'flat_sen',
];

// What a RateForm edits, as typed. The minutes are prefilled with the most
// common car park rule, so a new rate only needs its prices.
export const EMPTY_RATE_FORM = Object.freeze({
  type: 'hourly',
  firstMinutes: '60',
  firstPrice: '',
  blockMinutes: '60',
  blockPrice: '',
  graceMinutes: '0',
  dailyCap: '',
  flatPrice: '',
});

const blank = (value) => String(value ?? '').trim() === '';

// Only the fields the chosen type shows count: RateForm keeps the other
// type's fields when switching, and a hidden value must not change the rate.
const PRICE_FIELDS = { hourly: ['firstPrice', 'blockPrice', 'dailyCap'], flat: ['flatPrice'] };

// True when no price was typed: the prefilled minutes alone are not a rate.
export function isRateFormEmpty(form) {
  const prices = PRICE_FIELDS[form?.type] ?? PRICE_FIELDS.hourly;
  return prices.every((field) => blank(form?.[field]));
}

// Whole minutes typed as digits only, or null.
function minutesOf(text) {
  const trimmed = String(text ?? '').trim();
  return /^\d+$/.test(trimmed) ? Number(trimmed) : null;
}

// Empty free minutes mean none; anything else must be whole minutes.
const graceOf = (form) => (blank(form.graceMinutes) ? 0 : minutesOf(form.graceMinutes));
const GRACE_ERROR = 'Enter the free minutes as a whole number, or 0.';

// The flat form shows the price per entry and the free minutes: many car
// parks charge a flat price but let a short stop leave free.
function flatFromForm(form) {
  const flat_sen = parseRM(form.flatPrice);
  if (flat_sen == null) return { error: 'Enter the price per entry, such as 5.00.' };
  const grace_minutes = graceOf(form);
  if (grace_minutes == null) return { error: GRACE_ERROR };
  return { rate: { type: 'flat', flat_sen, grace_minutes } };
}

// Checked in the order the form shows the fields, so the first error is the
// first field to fix. The messages use RateForm's field labels.
function hourlyFromForm(form) {
  const first_minutes = minutesOf(form.firstMinutes);
  if (!first_minutes) return { error: 'Enter the first period in whole minutes, such as 60.' };
  const first_sen = parseRM(form.firstPrice);
  if (first_sen == null) return { error: 'Enter the first price, such as 3.00.' };
  const block_minutes = minutesOf(form.blockMinutes);
  if (!block_minutes) return { error: 'Enter each block in whole minutes, such as 60.' };
  const block_sen = parseRM(form.blockPrice);
  if (block_sen == null) return { error: 'Enter the block price, such as 2.00.' };
  const grace_minutes = graceOf(form);
  if (grace_minutes == null) return { error: GRACE_ERROR };
  let daily_cap_sen = null;
  if (!blank(form.dailyCap)) {
    daily_cap_sen = parseRM(form.dailyCap);
    // A cap of 0 would make every stay free, so it is refused rather than saved.
    if (!daily_cap_sen) return { error: 'Enter a daily max above zero, or leave it empty.' };
  }
  return {
    rate: { type: 'hourly', first_minutes, first_sen, block_minutes, block_sen, grace_minutes, daily_cap_sen },
  };
}

// Reads a RateForm into the fee fields of a place_rate. Returns { rate, error }.
// A rate is optional, so an empty form is { rate: null, error: null }; a partly
// filled one has no rate and a short sentence to show under the form.
export function rateFromForm(form) {
  if (isRateFormEmpty(form)) return { rate: null, error: null };
  const { rate, error } = form.type === 'flat' ? flatFromForm(form) : hourlyFromForm(form);
  return error ? { rate: null, error } : { rate: feeFields(rate), error: null };
}

// The form for a saved rate, or EMPTY_RATE_FORM for none.
export function formFromRate(rate) {
  if (!rate) return { ...EMPTY_RATE_FORM };
  if (rate.type === 'flat') {
    return {
      ...EMPTY_RATE_FORM,
      type: 'flat',
      flatPrice: formatAmountInput(rate.flat_sen),
      graceMinutes: String(rate.grace_minutes ?? 0),
    };
  }
  return {
    ...EMPTY_RATE_FORM,
    firstMinutes: String(rate.first_minutes),
    firstPrice: formatAmountInput(rate.first_sen),
    blockMinutes: String(rate.block_minutes),
    blockPrice: formatAmountInput(rate.block_sen),
    graceMinutes: String(rate.grace_minutes ?? 0),
    dailyCap: formatAmountInput(rate.daily_cap_sen),
  };
}

// The fixed public holiday amount, which the schema allows only as a flat rate.
export function holidayRate(sen) {
  return feeFields({ type: 'flat', flat_sen: sen });
}

export const HOLIDAY_AMOUNT_ERROR = 'Enter the public holiday amount, such as 8.00, or leave it empty.';

// The public holiday amount as typed on Park or a place's rates. The amount
// is optional, so blank is { rate: null, error: null }; text that is not an
// amount is an error, never a guess.
export function holidayRateFromText(text) {
  if (blank(text)) return { rate: null, error: null };
  const sen = parseRM(text);
  if (sen == null) return { rate: null, error: HOLIDAY_AMOUNT_ERROR };
  return { rate: holidayRate(sen), error: null };
}

// Only the fee fields of a place_rate row (no id, place or timestamps), with
// unset fields as null and grace as 0, the column default. null for no rate.
export function feeFields(rate) {
  if (!rate) return null;
  const fields = {};
  for (const field of FEE_FIELDS) fields[field] = rate[field] ?? null;
  if (fields.grace_minutes == null) fields.grace_minutes = 0;
  return fields;
}

// True when two rates charge the same, whatever their ids or timestamps.
export function sameRate(a, b) {
  const x = feeFields(a);
  const y = feeFields(b);
  if (!x || !y) return x === y;
  return FEE_FIELDS.every((field) => x[field] === y[field]);
}

// Which rates typed on Park to save. saved is the place's
// { weekday, weekend, holiday } (rows or null); entered is { [dayType]: rate }.
// A day type with no saved rate is saved without asking; a changed saved rate
// is asked about first, because a one-off promotion should not overwrite it.
export function planRateSave(saved, entered) {
  const plan = { autoSave: [], changed: [], unchanged: [] };
  for (const dayType of DAY_TYPES) {
    const rate = entered?.[dayType];
    if (!rate) continue;
    const current = saved?.[dayType];
    if (!current) plan.autoSave.push(dayType);
    else if (sameRate(current, rate)) plan.unchanged.push(dayType);
    else plan.changed.push(dayType);
  }
  return plan;
}
