import { isUsableReading, nearestPlace } from '../lib/geo';

// Park fills in the place from the location (PLAN.md, "Location"): once, from
// the reading kept when reading has finished (so a stale cached position
// cannot pick it while a fresh one is on its way), and never once the user
// has picked or typed a place.
export function shouldFillPlace({ touched, filled, finding, reading }) {
  return !touched && !filled && !finding && isUsableReading(reading);
}

// The place at reading, for the place picker, or null when nothing is found:
// 1. the nearest saved place (listSavedPlaces, rows with lat and lng), as { id, name };
// 2. else the nearest car park in the built-in list (listCarParks, M11), as
//    { id: null, name, carParkId }: a new place with the list's rates; or,
//    when its name is already a saved place (place_id), that saved place;
// 3. else a new place named by lookUpName (the online geocoder), as { id: null, name }.
// The list comes before the geocoder, so a listed car park needs no lookup online.
export async function placeForReading(reading, { listSavedPlaces, listCarParks, lookUpName }) {
  if (!isUsableReading(reading)) return null;
  const saved = nearestPlace(await listSavedPlaces(), reading);
  if (saved) return { id: saved.id, name: saved.name };
  const listed = nearestPlace(await listCarParks(), reading);
  if (listed?.place_id) return { id: listed.place_id, name: listed.place_name };
  if (listed) return { id: null, name: listed.name, carParkId: listed.id };
  const name = await lookUpName(reading);
  return name ? { id: null, name } : null;
}
