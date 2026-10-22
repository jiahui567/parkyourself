import { isNewPlaceName, typedPlaceToConfirm } from './placeName';

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
