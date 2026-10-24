import { accuracyText, autoPlaceHint, LOCATION_PURPOSE, locationSwitchHint, parkPlaceHint } from './locationText';

const PRECISE = { lat: 3.1279, lng: 101.7238, accuracyM: 12.4 };
const ROUGH = { lat: 3.1279, lng: 101.7238, accuracyM: 850 };

describe('accuracyText', () => {
  it.each([
    [12.4, '±12 m'],
    [0.2, '±1 m'],
    [200, '±200 m'],
  ])('writes %p metres as %p', (metres, text) => {
    expect(accuracyText(metres)).toBe(text);
  });
});

describe('autoPlaceHint', () => {
  it('tells a new place from a saved one', () => {
    expect(autoPlaceHint(true)).toBe('Found from your location, saved when you park');
    expect(autoPlaceHint(false)).toBe('Nearby, from your location');
  });
});

describe('parkPlaceHint', () => {
  it.each([
    {
      rule: 'says a place came from the location',
      state: { hasPlace: true, fromLocation: true, isNew: false, reading: PRECISE },
      hint: 'Nearby, from your location',
    },
    {
      rule: 'says a nearby place came from the car park list',
      state: { hasPlace: true, fromLocation: true, isNew: true, isListed: true, reading: PRECISE },
      hint: 'Nearby, from the car park list',
    },
    {
      rule: 'says nothing about a place the user picked',
      state: { hasPlace: true, fromLocation: false, reading: PRECISE },
      hint: null,
    },
    {
      rule: 'says it is still finding',
      state: { hasPlace: false, finding: true, reading: null },
      hint: 'Finding where you are…',
    },
    {
      rule: 'says nothing while a usable reading is being named',
      state: { hasPlace: false, finding: false, reading: PRECISE },
      hint: null,
    },
    {
      rule: 'says when a usable reading found no name',
      state: { hasPlace: false, finding: false, reading: PRECISE, noName: true },
      hint: 'Could not name this place. Pick or type it above.',
    },
    {
      rule: 'says when Android does not allow the location',
      state: { hasPlace: false, blocked: true, reading: null },
      hint: 'Location is not allowed in Android settings, so the place is not filled in.',
    },
    {
      rule: 'says how rough a reading was too rough',
      state: { hasPlace: false, finding: false, reading: ROUGH },
      hint: 'Only known to ±850 m, too rough to fill in the place. Pick it above.',
    },
  ])('$rule', ({ state, hint }) => {
    expect(parkPlaceHint(state)).toBe(hint);
  });

  it('explains a missing reading', () => {
    expect(parkPlaceHint({ hasPlace: false, finding: false, reading: null })).toMatch(/^Could not find where you are/);
  });
});

describe('locationSwitchHint', () => {
  it('says what the location is for', () => {
    expect(locationSwitchHint({ granted: true, canAskAgain: true })).toBe(LOCATION_PURPOSE);
    expect(locationSwitchHint({ granted: false, canAskAgain: true })).toBe(LOCATION_PURPOSE);
    expect(locationSwitchHint(null)).toBe(LOCATION_PURPOSE);
  });

  it('warns that Android settings open once Android no longer asks', () => {
    expect(locationSwitchHint({ granted: false, canAskAgain: false })).toMatch(/opens Android settings/);
  });
});
