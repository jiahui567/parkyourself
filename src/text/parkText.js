import { DAY_TYPES, holidayRateFromText, rateFromForm } from '../fees';
import { formatDateKey } from '../lib/time';
import { fillsOther } from '../ocr/pillarText';
import { dayTypeLabel, rateSummary } from './rateText';

// Text for the Park screen's place picker and rate questions.

// Under a listed car park in the place search: 'From the car park list · Cheras, Kuala Lumpur'.
export function listedPlaceHint({ area }) {
  return area ? `From the car park list · ${area}` : 'From the car park list';
}

// Under the rate on Park when it came from the built-in car park list (M11):
// where it came from and how old it is, and what the list could not show.
export function listedRateHint({ checked_on, effective_from, notes }) {
  const since = effective_from ? `, in effect since ${formatDateKey(effective_from)}` : '';
  const lead =
    `From the car park list (checked ${formatDateKey(checked_on)}${since}). ` +
    'Check the sign: these rates are saved to this place when you park.';
  return notes ? `${lead} ${notes}` : lead;
}

const NOT_FINISHED = 'Not finished · tap to check it';

// Park's folded rate row: its label, and a hint with the rate the form holds,
// so the rate can be checked without opening it. dayType is the form shown
// (rateDayTypeFor). Either part not finished makes the row say so, checked in
// enteredRates' order, as Save would refuse it. With holidayOn (today is in
// the holiday list), the public holiday amount is shown (holidayAmount, the
// saved one prefilled, else savedHoliday), as the fee uses it; the weekend
// form only when there is neither.
// { label: 'Weekday rate', hint: 'RM 3.00 first hour, then RM 2.00 per hour' }
export function parkRateRowText({ dayType, form, holidayOn = false, holidayAmount = '', savedHoliday = null }) {
  const label = holidayOn ? 'Public holiday rate' : `${dayTypeLabel(dayType)} rate`;
  const { rate, error } = rateFromForm(form);
  if (error) return { label, hint: NOT_FINISHED };
  if (holidayOn) {
    const typed = holidayRateFromText(holidayAmount);
    if (typed.error) return { label, hint: NOT_FINISHED };
    const holiday = typed.rate ?? savedHoliday;
    if (holiday) return { label, hint: rateSummary(holiday) };
  }
  const prefix = holidayOn ? 'Weekend rate: ' : '';
  return { label, hint: rate ? `${prefix}${rateSummary(rate)}` : `${prefix}Not set · optional` };
}

const SAVED_NAMES = { weekday: 'weekday rate', weekend: 'weekend rate', holiday: 'public holiday amount' };

// 'a', 'a and b', 'a, b and c'
function listText(items) {
  if (items.length < 2) return items[0];
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

// The question before replacing saved rates the user changed on Park (PLAN.md,
// "User flow"): 'Update the saved weekend rate for Pavilion Bukit Jalil?'.
// Several changes make one question. null when nothing changed.
export function rateUpdateQuestion(changed, placeName) {
  const names = DAY_TYPES.filter((dayType) => changed?.includes(dayType)).map((dayType) => SAVED_NAMES[dayType]);
  if (names.length === 0) return null;
  return `Update the saved ${listText(names)} for ${placeName}?`;
}

// The line under Park's "From the photo", for the codes read (codeRows): one
// tap does both when fillsOther, and a single code is either one. filled: the
// level or bay below holds a code from the photo (fillFromSign filled it in).
export function photoCodesHint(codes, filled = false) {
  if (filled) return 'Filled in below from the photo. Check it, or tap another code.';
  if (fillsOther(codes)) return 'Tap the level or the bay, and the other code fills in.';
  if (codes.length === 1) return 'Tap it as the level or the bay, and type the other below.';
  return 'Tap the level and the bay, or type them below.';
}

// The line in Park's rate row on a date in the holiday list, which Park does
// not change (PLAN.md, "User flow"): a saved amount (savedHoliday, a
// place_rate) is used instead of the form, so the line says so.
export function holidayRateHint(savedHoliday) {
  return savedHoliday
    ? `Today is a public holiday: ${rateSummary(savedHoliday)} is used. Change it in Settings > Places.`
    : 'Today is a public holiday, so the weekend rate below is used.';
}

// The picker row that adds a typed name: 'Add "Sunway Pyramid" as a new place'.
export function addPlaceLabel(name) {
  return `Add "${String(name ?? '').trim()}" as a new place`;
}

// The question when Save is tapped with a place name typed but no place
// picked (PLAN.md, "User flow"): 'Park at "Pavilion" as a new place?'. savedName is the saved
// place the typed name matches (any case): 'Park at "Pavilion Bukit Jalil"?'.
export function typedPlaceQuestion(typed, savedName = null) {
  if (savedName) return `Park at "${savedName}"?`;
  return `Park at "${String(typed ?? '').trim()}" as a new place?`;
}

// The answer to typedPlaceQuestion that parks at the place chosen before the
// user tapped Change: 'Keep "Pavilion"'.
export function keepPlaceLabel(name) {
  return `Keep "${name}"`;
}
