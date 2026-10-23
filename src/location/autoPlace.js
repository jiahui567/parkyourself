import { isUsableReading, nearestPlace } from '../lib/geo';

// Park fills in the place from the location (PLAN.md, "Location"): once, from
// the reading kept when reading has finished (so a stale cached position
// cannot pick it while a fresh one is on its way), and never once the user
// has picked or typed a place.
export function shouldFillPlace({ touched, filled, finding, reading }) {
  return !touched && !filled && !finding && isUsableReading(reading);
}

// The place at reading: the nearest saved place (listSavedPlaces, rows with
// lat and lng), else a new place named by lookUpName (the online geocoder),
// as { id, name } for the place picker, or null when neither finds one.
export async function placeForReading(reading, { listSavedPlaces, lookUpName }) {
  if (!isUsableReading(reading)) return null;
  const saved = nearestPlace(await listSavedPlaces(), reading);
  if (saved) return { id: saved.id, name: saved.name };
  const name = await lookUpName(reading);
  return name ? { id: null, name } : null;
}
