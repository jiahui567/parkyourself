import { isUsableReading } from '../lib/geo';

// Text for the location on Park and in Settings (PLAN.md, "Location").

// What Use location when parking does, said under its switch in Settings.
export const LOCATION_PURPOSE =
  'Fills in the place when you park and saves where the car is, for walking directions back. ' +
  'Read only while Park is open. A new place is named through Google.';

// '±12 m'
export function accuracyText(metres) {
  return `±${Math.max(1, Math.round(metres))} m`;
}

// The line under a place the location filled in, in Park's place picker.
export function autoPlaceHint(isNew) {
  return isNew ? 'Found from your location, saved when you park' : 'Nearby, from your location';
}

// The muted line under Park's place while Use location when parking is on:
// where the place came from, or why it is still empty. null when there is
// nothing to say (a place the user picked, or a name still being looked up).
// blocked: Android does not allow the location; noName: a usable reading
// found no saved place nearby and no name.
export function parkPlaceHint({ hasPlace, fromLocation, isNew, isListed, finding, reading, blocked, noName }) {
  if (hasPlace && fromLocation && isListed) return 'Nearby, from the car park list';
  if (hasPlace) return fromLocation ? autoPlaceHint(isNew) : null;
  if (blocked) return 'Location is not allowed in Android settings, so the place is not filled in.';
  if (finding) return 'Finding where you are…';
  if (noName) return 'Could not name this place. Pick or type it above.';
  if (isUsableReading(reading)) return null;
  if (reading) return `Only known to ${accuracyText(reading.accuracyM)}, too rough to fill in the place. Pick it above.`;
  return 'Could not find where you are, often the case underground. Pick or type the place above.';
}

// The hint under Settings' Use location when parking switch. Android lets an
// app ask twice; after that, turning it on opens the app's Android settings,
// so it says so.
export function locationSwitchHint(permission) {
  if (permission && !permission.granted && permission.canAskAgain === false) {
    return `${LOCATION_PURPOSE} Turning it on opens Android settings, where you allow the location.`;
  }
  return LOCATION_PURPOSE;
}
