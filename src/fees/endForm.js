import { formatAmountInput, parseRM } from '../lib/money';
import { stayDayTypes } from './calcFee';
import { EMPTY_RATE_FORM, rateFromForm } from './rateForm';
import { ratesFromSnapshot } from './sessionFee';

// The "Found my car" summary (PLAN.md, "Returning" and "Missing rate later in
// a stay"). The screen keeps what the user types; these rules turn it into the
// fee preview and into the input of sessions.end, with the same rates, so the
// fee shown is the fee saved.

// The rate a day of the stay is priced with: a public holiday uses its fixed
// amount, or the weekend rate when there is none.
const neededRate = (dayType, rates) => (dayType === 'holiday' ? (rates.holiday ? 'holiday' : 'weekend') : dayType);

// The day types to ask a rate for when a session ends at endMs (PLAN.md, "Missing rate later in a stay"): each one
// a day of the stay needs that its rate snapshot lacks, in the order the stay
// reached them. This also covers a session with no rate at all. Only for a
// session with a place, since the rate is saved there.
export function missingRateTypes(session, endMs, holidayDates) {
  if (!session.place_id) return [];
  const rates = ratesFromSnapshot(session.rate_snapshot) ?? {};
  const missing = new Set();
  for (const dayType of stayDayTypes(session.started_at, endMs, holidayDates)) {
    const needed = neededRate(dayType, rates);
    if (!rates[needed]) missing.add(needed);
  }
  return [...missing];
}

// Whether sessions.end saves a missing rate typed for dayType to the place:
// only while the place exists (placeRates from places.getRates, null when it
// was deleted) and still has no rate for that day type. Otherwise the rate is
// used for this stay only.
export function savesMissingRate(placeRates, dayType) {
  return placeRates != null && !placeRates[dayType];
}

// The rates typed so far that are complete, by day type, for the preview.
// An empty or half-typed form is left out, so the fee stays the estimate until
// the rate is whole.
export function typedRates(forms, dayTypes) {
  const rates = {};
  for (const dayType of dayTypes) {
    const { rate } = rateFromForm(forms[dayType] ?? EMPTY_RATE_FORM);
    if (rate) rates[dayType] = rate;
  }
  return rates;
}

// What the Amount paid field shows: the previewed fee until the user edits the
// field (typed stays null until then), so it follows a rate typed above it.
// Empty when there is no fee.
export function amountPaidText(fee, typed) {
  if (typed != null) return typed;
  return formatAmountInput(fee?.feeSen ?? null);
}

const PAID_ERROR = 'Enter the amount paid, such as 3.00.';

// Reads the summary into sessions.end's input { ended_at, paid_sen,
// missing_rates }. A missing rate is optional (left empty, the fee stays the
// estimate), but a half-typed one is an error. An empty amount means none was
// typed; one that cannot be read is an error. Returns { input, rateErrors,
// paidError }: rateErrors has a sentence per day type, and input is null while
// there is any error.
export function readEndForm({ endedAt, forms, dayTypes, paidText }) {
  const rateErrors = {};
  for (const dayType of dayTypes) {
    const { error } = rateFromForm(forms[dayType] ?? EMPTY_RATE_FORM);
    if (error) rateErrors[dayType] = error;
  }
  const blank = String(paidText ?? '').trim() === '';
  const paid_sen = blank ? null : parseRM(paidText);
  const paidError = !blank && paid_sen == null ? PAID_ERROR : null;
  if (paidError || Object.keys(rateErrors).length > 0) return { input: null, rateErrors, paidError };

  const missing = typedRates(forms, dayTypes);
  return {
    input: { ended_at: endedAt, paid_sen, missing_rates: Object.keys(missing).length > 0 ? missing : null },
    rateErrors,
    paidError,
  };
}
