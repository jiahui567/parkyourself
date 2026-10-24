import { DAY_TYPES, feeFields, holidayRateFromText, rateFromForm } from './rateForm';

// Which rate Park asks for and which typed rates it passes on (PLAN.md, "User
// flow", Parking step 2). Pure: the screen loads, shows and saves.

const OTHER_DAY_TYPE = { weekday: 'weekend', weekend: 'weekday' };

// The day type whose rate the Park form shows: 'weekday' or 'weekend'. A
// public holiday (a date in the holiday list) shows the weekend rate,
// because a holiday without a fixed amount is charged at it.
export function rateDayTypeFor(todayType, holidayOn) {
  return todayType === 'holiday' || holidayOn ? 'weekend' : todayType;
}

// "Same rate every day" saves the rate for weekday and weekend at once, so it
// is offered only when neither has a saved rate: a saved rate is never
// replaced without the update question.
export function offersSameEveryDay(saved, dayType) {
  return !saved?.[dayType] && !saved?.[OTHER_DAY_TYPE[dayType]];
}

// The rates typed on Park, { [dayType]: rate }, for planRateSave and
// sessions.start. form is the RateForm shown for dayType; holidayAmount (RM
// text, the place's saved amount on Park) counts only on a public holiday. Returns { entered, error }: error
// is a sentence for the user, and then entered is null.
export function enteredRates({ saved, dayType, form, sameEveryDay = false, holidayOn = false, holidayAmount = '' }) {
  const { rate, error } = rateFromForm(form);
  if (error) return { entered: null, error };
  const entered = {};
  if (rate) {
    entered[dayType] = rate;
    if (sameEveryDay && offersSameEveryDay(saved, dayType)) entered[OTHER_DAY_TYPE[dayType]] = rate;
  }
  if (holidayOn) {
    const holiday = holidayRateFromText(holidayAmount);
    if (holiday.error) return { entered: null, error: holiday.error };
    if (holiday.rate) entered.holiday = holiday.rate;
  }
  return { entered, error: null };
}

// A new place picked from the built-in car park list (M11) keeps every rate
// the list has, not only the one Park shows today: entered plus the list's
// rates for the day types not shown. A shown form the user cleared stays
// cleared. shown: the day types Park's form showed (today's, and 'holiday'
// on a public holiday).
export function withListedRates(entered, listedRates, shown) {
  const all = { ...entered };
  for (const dayType of DAY_TYPES) {
    const listed = listedRates?.[dayType];
    if (listed && !shown.includes(dayType) && !all[dayType]) all[dayType] = feeFields(listed);
  }
  return all;
}

// The day types to save to the place, from planRateSave's plan. "Only this
// time" saves only rates the place had none of; "Yes, update" also replaces
// the changed ones.
export function ratesToSave(plan, update) {
  return update ? [...plan.autoSave, ...plan.changed] : [...plan.autoSave];
}
