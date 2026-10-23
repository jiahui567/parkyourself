import { isNewPlaceName, placeNameFromAddress, typedPlaceToConfirm } from './placeName';

const PLACES = [{ name: 'Pavilion Bukit Jalil' }, { name: 'Pavilion KL' }];

describe('isNewPlaceName', () => {
  it.each([
    { rule: 'a saved name typed in another case and with spaces is not new', typed: ' pavilion bukit JALIL ', isNew: false },
    { rule: 'part of a saved name is new', typed: 'Pavilion', isNew: true },
    { rule: 'blank text names no place', typed: '   ', isNew: false },
  ])('$rule', ({ typed, isNew }) => {
    expect(isNewPlaceName(PLACES, typed)).toBe(isNew);
  });
});

describe('typedPlaceToConfirm', () => {
  const pavilion = { id: 'p1', name: 'Pavilion Bukit Jalil' };

  it.each([
    { rule: 'a name typed with no place chosen is asked about', chosen: null, typed: ' Sunway Pyramid ', ask: 'Sunway Pyramid' },
    { rule: 'a name typed after Change is asked about', chosen: pavilion, typed: 'Sunway Pyramid', ask: 'Sunway Pyramid' },
    { rule: "the chosen place's own name, any case, is not", chosen: pavilion, typed: ' pavilion BUKIT jalil ', ask: null },
    { rule: 'nothing typed is not', chosen: pavilion, typed: '  ', ask: null },
  ])('$rule', ({ chosen, typed, ask }) => {
    expect(typedPlaceToConfirm(chosen, typed)).toBe(ask);
  });
});

describe('placeNameFromAddress', () => {
  const address = (fields) => ({ name: null, street: null, streetNumber: null, city: 'Kuala Lumpur', ...fields });

  it.each([
    { rule: 'a building name is used', fields: { name: 'Sunway Velocity Mall', street: 'Jalan Cheras' }, name: 'Sunway Velocity Mall' },
    { rule: 'a name starting with a number is still a name', fields: { name: '1 Utama', street: 'Lebuh Bandar Utama' }, name: '1 Utama' },
    { rule: 'a house number falls back to the street', fields: { name: '12', street: 'Jalan Cerdas', streetNumber: '12' }, name: 'Jalan Cerdas' },
    { rule: 'a unit number falls back to the street', fields: { name: '3-1A', street: 'Jalan SS 2/24' }, name: 'Jalan SS 2/24' },
    { rule: 'a plus code falls back to the street', fields: { name: '4QGF+5X', street: 'Jalan Peel' }, name: 'Jalan Peel' },
    { rule: 'surrounding spaces are trimmed', fields: { name: '  Mid Valley Megamall ' }, name: 'Mid Valley Megamall' },
    { rule: 'nothing usable gives null', fields: { name: '12', streetNumber: '12' }, name: null },
  ])('$rule', ({ fields, name }) => {
    expect(placeNameFromAddress(address(fields))).toBe(name);
  });

  it('gives null without an address', () => {
    expect(placeNameFromAddress(undefined)).toBeNull();
  });
});
