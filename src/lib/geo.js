// Location rules for Park and Find (PLAN.md, "Location"). A reading is
// { lat, lng, accuracyM }: degrees, and the radius in metres the phone is
// likely within.

// A reading less precise than this is neither saved nor used to fill in the
// place: a pin this far off would lead the walk back to the wrong building.
export const USABLE_ACCURACY_M = 200;

// A saved place this close to the reading is taken to be where the car is.
// A big mall and its car park can be a few hundred metres across.
export const NEARBY_M = 300;

const EARTH_RADIUS_M = 6371000;
const radians = (degrees) => (degrees * Math.PI) / 180;

// Metres between two points ({ lat, lng }) along the ground (haversine).
export function distanceMetres(a, b) {
  const dLat = radians(b.lat - a.lat);
  const dLng = radians(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function isUsableReading(reading) {
  return reading != null && Number.isFinite(reading.accuracyM) && reading.accuracyM <= USABLE_ACCURACY_M;
}

// The more precise of two readings (either may be null). Underground the
// phone's last known position, from near the entrance, often beats a fresh one.
export function moreAccurate(a, b) {
  if (!a) return b ?? null;
  if (!b) return a;
  return b.accuracyM < a.accuracyM ? b : a;
}

// The saved place (rows with lat and lng) nearest a usable reading, within
// NEARBY_M, or null.
export function nearestPlace(places, reading) {
  if (!isUsableReading(reading)) return null;
  let best = null;
  let bestDistance = Infinity;
  for (const place of places) {
    if (place.lat == null || place.lng == null) continue;
    const distance = distanceMetres(reading, place);
    if (distance <= NEARBY_M && distance < bestDistance) {
      best = place;
      bestDistance = distance;
    }
  }
  return best;
}
