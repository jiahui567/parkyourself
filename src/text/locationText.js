import { isUsableReading } from '../lib/geo';

// Text for the location on Park and in Settings (PLAN.md, "Location").

// What allowing the location does, said where it is offered (Park and Settings).
export const LOCATION_PURPOSE =
  'Fills in the place when you park and saves where the car is, for walking directions back. ' +
  'Read only while Park is open. A new place is named through Google. \n\n' +
  'You can turn it off in your device settings.';

// '±12 m'
export function accuracyText(metres) {
  return `±${Math.max(1, Math.round(metres))} m`;
}

// The value at the end of Park's folded Location row. permission is null
// until it has been checked; saveOn is the row's "Save where I parked" switch.
export function locationRowValue({ permission, reading, finding, saveOn }) {
  if (!permission) return null;
  if (!permission.granted) return 'Off';
  if (!saveOn) return 'Not saved';
  if (isUsableReading(reading)) return accuracyText(reading.accuracyM);
  return finding ? 'Finding…' : 'Not found';
}

// The line under the switch in Park's Location row, while the location is allowed.
export function locationHint({ reading, finding, saveOn }) {
  if (!saveOn) return 'Not saved with this park. It still fills in the place.';
  if (isUsableReading(reading)) return 'For walking directions back in Google Maps.';
  if (finding) return 'Finding where you are…';
  if (reading) {
    return `Only known to ${accuracyText(reading.accuracyM)}, too rough to save. Try again near the entrance or in the open.`;
  }
  return 'No location yet. Underground there is often no signal: try again near the entrance or in the open.';
}

// The line under a place the location filled in, in Park's place picker.
export function autoPlaceHint(isNew) {
  return isNew ? 'Found from your location, saved when you park' : 'Nearby, from your location';
}

// The button that allows the location: Android lets an app ask twice, then
// only its settings page can allow it.
export function allowLocationLabel(permission) {
  return permission?.canAskAgain === false ? 'Open Android settings' : 'Allow location';
}
