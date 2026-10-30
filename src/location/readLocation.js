import * as Location from 'expo-location';

import { placeNameFromAddress } from '../lib/placeName';
import { withTimeout } from '../lib/timeout';

// The only code that calls expo-location. Location is read in the foreground
// only, while Park is open, and never tracked (PLAN.md, "Location"). Readings
// are { lat, lng, accuracyM }; src/lib/geo.js decides what they are good for.

// The phone's cached position is used only this fresh: an older one may be
// from before the drive to this car park.
const LAST_KNOWN_MAX_AGE_MS = 5 * 60 * 1000;
// getCurrentPositionAsync has no time limit of its own, and underground it
// may never find one.
const FRESH_TIMEOUT_MS = 10 * 1000;
// How long the place name lookup may take (lookUpPlaceName).
const LOOKUP_TIMEOUT_MS = 10 * 1000;

const toReading = (position) =>
  position && {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    accuracyM: position.coords.accuracy,
  };

// { granted, canAskAgain }, without asking.
export function locationPermission() {
  return Location.getForegroundPermissionsAsync();
}

// Asks for the permission when the user taps Allow location. Android lets an
// app ask twice; after that it answers without asking. Returns { granted, canAskAgain }.
export async function askLocationPermission() {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.granted || !current.canAskAgain) return current;
  return Location.requestForegroundPermissionsAsync();
}

// The position the phone last had, if recent, or null. Instant, and still
// there in a basement with no signal.
export async function lastKnownLocation() {
  return toReading(await Location.getLastKnownPositionAsync({ maxAge: LAST_KNOWN_MAX_AGE_MS }));
}

// A new reading, or null when none comes in time. No dialog asks to turn on
// location services: the location is optional, so Park never interrupts for it.
export async function currentLocation() {
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve(null), FRESH_TIMEOUT_MS);
  });
  try {
    const position = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High, mayShowUserSettingsDialog: false }),
      timeout,
    ]);
    return toReading(position);
  } finally {
    clearTimeout(timer);
  }
}

// A name for the place at reading, looked up online by Android's geocoder,
// which sends the location to Google (accepted by the user on 2026-10-23,
// AGENTS.md "Privacy"). null when it finds nothing that reads as a name.
// Time-limited: on Android 13 and later, expo-location 58 waits only for the
// geocoder's answer and never hears its error (no signal), so the lookup
// would never end and Park could never say so or try again. The message
// follows "Could not name this place:" on Park.
export async function lookUpPlaceName(reading) {
  const [address] = await withTimeout(
    Location.reverseGeocodeAsync({ latitude: reading.lat, longitude: reading.lng }),
    LOOKUP_TIMEOUT_MS,
    'the lookup took too long'
  );
  return placeNameFromAddress(address);
}
