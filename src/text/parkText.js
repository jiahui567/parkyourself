import { DAY_TYPES } from '../fees';

// Text for the Park screen's place picker and rate questions.

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

// The line under Park's public holiday amount. An emptied field still uses a
// saved amount (rate_snapshot keeps the place's saved rates), so with one
// saved the hint says where to remove it instead.
export function holidayAmountHint(hasSavedAmount) {
  return hasSavedAmount
    ? 'Filled in from your saved amount. To use the weekend rate instead, remove it in Settings > Places.'
    : 'With no amount, a public holiday uses the weekend rate above.';
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
