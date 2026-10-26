import { formatMonth } from '../lib/time';
import { NO_PLACE } from '../spending/historyFilter';
import { sessionCountText } from './spendingText';

// Text for History's filters (src/spending/historyFilter.js). kind is
// 'vehicle', 'place' or 'month'; a choice is { value, name, sessions }.

const ALL_TEXT = { vehicle: 'All cars', place: 'All places', month: 'All months' };
const TITLE_TEXT = { vehicle: 'Car', place: 'Place', month: 'Month' };

// A choice as listed: the car or place name, 'No place', or 'Oct 2026'.
export function filterChoiceText(kind, choice) {
  if (kind === 'month') return formatMonth(choice.value);
  if (kind === 'place' && choice.value === NO_PLACE) return 'No place';
  return choice.name;
}

// A filter's pill: the choice made, or 'All places' when none is.
export function filterPillText(kind, selected) {
  return selected ? filterChoiceText(kind, selected) : ALL_TEXT[kind];
}

// What a screen reader says for a pill: 'Place: All places'.
export function filterPillLabel(kind, selected) {
  return `${TITLE_TEXT[kind]}: ${filterPillText(kind, selected)}`;
}

// The title of a filter's sheet: 'Place'.
export function filterTitleText(kind) {
  return TITLE_TEXT[kind];
}

// The rows of a filter's sheet, from filterChoices' { all, options }: 'All
// places' first (value null), then each choice, each with its session count
// and what a screen reader says ('Sunway Pyramid, 3 sessions').
export function filterSheetOptions(kind, { all, options }) {
  const rows = [{ value: null, label: ALL_TEXT[kind], sessions: all }];
  for (const choice of options) {
    rows.push({ value: choice.value, label: filterChoiceText(kind, choice), sessions: choice.sessions });
  }
  return rows.map(({ value, label, sessions }) => ({
    value,
    label,
    countText: String(sessions),
    accessibilityLabel: `${label}, ${sessionCountText(sessions)}`,
  }));
}
