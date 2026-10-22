import { formatAmountInput } from '../lib/money';
import { dayTypeLabel } from '../text/rateText';
import { formFromRate, holidayRateFromText, rateFromForm, sameRate } from './rateForm';

// The Places edit screen's rates as typed: a RateForm for the weekday and the
// weekend, and the public holiday amount (PLAN.md, "Saved places and rates").

// { weekday, weekend, holidayAmount } for the place's saved rates
// (places.getRates). A missing rate is an empty form or an empty amount.
export function placeRatesFormFrom(rates) {
  return {
    weekday: formFromRate(rates?.weekday ?? null),
    weekend: formFromRate(rates?.weekend ?? null),
    holidayAmount: formatAmountInput(rates?.holiday?.flat_sen ?? null),
  };
}

// The rates to pass to places.saveDetails: { weekday, weekend, holiday }, each a
// rate or null. null removes that saved rate, so clearing a form is how the
// user deletes it. Returns { rates, error }; error is the first problem, in the
// order the screen shows the forms, and rates is null with it.
export function ratesFromPlaceRatesForm(form) {
  const rates = {};
  for (const dayType of ['weekday', 'weekend']) {
    const { rate, error } = rateFromForm(form[dayType]);
    // Starts with the card title ('Weekday rate'), so the user knows which form to fix.
    if (error) return { rates: null, error: `${dayTypeLabel(dayType)} rate: ${error}` };
    rates[dayType] = rate;
  }
  const holiday = holidayRateFromText(form.holidayAmount);
  if (holiday.error) return { rates: null, error: holiday.error };
  return { rates: { ...rates, holiday: holiday.rate }, error: null };
}

// Only the day types in rates that differ from saved (places.getRates), so a
// Save leaves an unchanged rate's row and updated_at alone; places.saveDetails
// keeps the day types left out. A rate that is still not saved (null and null)
// is no change either.
export function changedPlaceRates(saved, rates) {
  const changes = {};
  for (const [dayType, rate] of Object.entries(rates)) {
    if (!sameRate(saved?.[dayType] ?? null, rate)) changes[dayType] = rate;
  }
  return changes;
}
