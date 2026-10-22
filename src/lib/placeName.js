// Place names are unique ignoring case and the spaces at their ends (PLAN.md,
// "Saved places and rates"), so "pavilion bukit jalil " is Pavilion Bukit Jalil.
const nameKey = (name) => String(name ?? '').trim().toLowerCase();

// True when typed names none of places (rows with a name), so the place
// picker offers to add it. Empty or blank text names no place.
export function isNewPlaceName(places, typed) {
  const key = nameKey(typed);
  return key !== '' && !places.some((place) => nameKey(place.name) === key);
}

// The name typed in Park's place picker but never tapped, which Save asks
// about before parking (PLAN.md, "User flow"), or null when there is nothing to ask. chosen is
// the picked place ({ name }) or null. A typed name is asked about even with a
// place chosen (after Change), unless it is that place's own name.
export function typedPlaceToConfirm(chosen, typed) {
  const key = nameKey(typed);
  if (key === '' || (chosen && nameKey(chosen.name) === key)) return null;
  return String(typed).trim();
}
