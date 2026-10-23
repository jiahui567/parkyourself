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

// Android's geocoder often names a point by its house number ('12', '3-1A')
// or a plus code ('4QGF+5X'), which say nothing to the user.
const NUMBER_LIKE = /^[\d\s,./-]*\d[\d\s,./-]*[A-Za-z]?$/;
const PLUS_CODE = /^[23456789CFGHJMPQRVWX]{2,8}\+[23456789CFGHJMPQRVWX]{0,3}\b/i;
const isWordName = (text) => text !== '' && !NUMBER_LIKE.test(text) && !PLUS_CODE.test(text);

// A name for a new place from a reverse-geocoded address (expo-location's
// reverseGeocodeAsync): the building or shop name ('Sunway Velocity Mall'),
// else the street, for parking by the road ('Jalan Cerdas'). null when
// neither is a word.
export function placeNameFromAddress(address) {
  if (!address) return null;
  const number = String(address.streetNumber ?? '').trim();
  for (const field of [address.name, address.street]) {
    const text = String(field ?? '').trim();
    if (isWordName(text) && text !== number) return text;
  }
  return null;
}
