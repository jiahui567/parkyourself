import { accuracyText, allowLocationLabel, autoPlaceHint, locationHint, locationRowValue } from './locationText';

const ALLOWED = { granted: true, canAskAgain: true };
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

describe('locationRowValue', () => {
  it.each([
    { rule: 'nothing while the permission is checked', state: { permission: null }, value: null },
    { rule: 'Off when not allowed', state: { permission: { granted: false, canAskAgain: true } }, value: 'Off' },
    { rule: 'the accuracy of a usable reading', state: { permission: ALLOWED, reading: PRECISE, saveOn: true }, value: '±12 m' },
    { rule: 'Not saved when switched off', state: { permission: ALLOWED, reading: PRECISE, saveOn: false }, value: 'Not saved' },
    { rule: 'Finding while reading', state: { permission: ALLOWED, reading: null, finding: true, saveOn: true }, value: 'Finding…' },
    { rule: 'Finding while a better reading may come', state: { permission: ALLOWED, reading: ROUGH, finding: true, saveOn: true }, value: 'Finding…' },
    { rule: 'Not found when only a rough reading came', state: { permission: ALLOWED, reading: ROUGH, finding: false, saveOn: true }, value: 'Not found' },
    { rule: 'Not found when none came', state: { permission: ALLOWED, reading: null, finding: false, saveOn: true }, value: 'Not found' },
  ])('$rule', ({ state, value }) => {
    expect(locationRowValue(state)).toBe(value);
  });
});

describe('locationHint', () => {
  it('says what a saved reading is for', () => {
    expect(locationHint({ reading: PRECISE, finding: false, saveOn: true })).toBe(
      'For walking directions back in Google Maps.'
    );
  });

  it('says nothing is saved when switched off', () => {
    expect(locationHint({ reading: PRECISE, finding: false, saveOn: false })).toBe(
      'Not saved with this park. It still fills in the place.'
    );
  });

  it('says it is still finding', () => {
    expect(locationHint({ reading: null, finding: true, saveOn: true })).toBe('Finding where you are…');
  });

  it('says how rough a reading is too rough', () => {
    expect(locationHint({ reading: ROUGH, finding: false, saveOn: true })).toBe(
      'Only known to ±850 m, too rough to save. Try again near the entrance or in the open.'
    );
  });

  it('explains a missing reading', () => {
    expect(locationHint({ reading: null, finding: false, saveOn: true })).toMatch(/^No location yet/);
  });
});

describe('autoPlaceHint', () => {
  it('tells a new place from a saved one', () => {
    expect(autoPlaceHint(true)).toBe('Found from your location, saved when you park');
    expect(autoPlaceHint(false)).toBe('Nearby, from your location');
  });
});

describe('allowLocationLabel', () => {
  it('asks while Android still lets the app ask', () => {
    expect(allowLocationLabel({ granted: false, canAskAgain: true })).toBe('Allow location');
  });

  it('opens the settings once Android no longer asks', () => {
    expect(allowLocationLabel({ granted: false, canAskAgain: false })).toBe('Open Android settings');
  });
});
