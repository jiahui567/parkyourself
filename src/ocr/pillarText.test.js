import {
  codeRows,
  fillsOther,
  pickCode,
  pillarCandidates,
  shouldReadNextPhoto,
  suggestionsFromPhotos,
} from './pillarText';

describe('pillarCandidates', () => {
  it.each([
    ['LEVEL B2\nZONE C-14', ['B2'], ['C14']],
    ['B2 C14', ['B2'], ['C14']],
    ['b2 c14', ['B2'], ['C14']],
    ['B 2  C 14', ['B2'], ['C14']],
    ['P3 - 25', ['P3'], ['25']],
    ['LG / A 07', ['LG'], ['A07']],
    ['L12 BAY 108', ['L12'], ['108']],
    ['UG ZONE D', ['UG'], []],
    ['LL 5', ['LL'], ['5']],
    ['B1 B2', ['B1', 'B2'], []],
    ['B2 B2 C14 C14', ['B2'], ['C14']],
  ])('%p -> levels %p, bays %p', (text, levels, bays) => {
    expect(pillarCandidates(text)).toEqual({ levels, bays });
  });

  it('offers both readings when a level letter is followed by a number', () => {
    expect(pillarCandidates('M 12')).toEqual({ levels: ['M'], bays: ['M12'] });
  });

  it('treats L21 as a bay, because levels stop at L20', () => {
    expect(pillarCandidates('L21')).toEqual({ levels: [], bays: ['L21'] });
  });

  it.each(['', 'EXIT', null, undefined])('finds nothing in %p', (text) => {
    expect(pillarCandidates(text)).toEqual({ levels: [], bays: [] });
  });
});

describe('suggestionsFromPhotos', () => {
  it('takes the suggestions from the first photo', () => {
    expect(suggestionsFromPhotos(['B2 C14', null])).toEqual({ levels: ['B2'], bays: ['C14'] });
  });

  it('moves on to the next photo when the first gave nothing', () => {
    expect(suggestionsFromPhotos(['EXIT', 'LEVEL B3 ZONE D-20'])).toEqual({ levels: ['B3'], bays: ['D20'] });
  });

  it('does not mix suggestions from two photos', () => {
    expect(suggestionsFromPhotos(['B2', 'C14'])).toEqual({ levels: ['B2'], bays: [] });
  });

  it('skips photos that were not read', () => {
    expect(suggestionsFromPhotos([null, 'B2 C14'])).toEqual({ levels: ['B2'], bays: ['C14'] });
  });

  it('has nothing to suggest without photos', () => {
    expect(suggestionsFromPhotos([])).toEqual({ levels: [], bays: [] });
  });
});

describe('shouldReadNextPhoto', () => {
  it('reads the first photo', () => {
    expect(shouldReadNextPhoto([])).toBe(true);
  });

  it('reads another photo only while the ones before gave nothing', () => {
    expect(shouldReadNextPhoto(['EXIT'])).toBe(true);
    expect(shouldReadNextPhoto(['B2 C14'])).toBe(false);
  });

  it('reads the next photo when OCR failed on the one before', () => {
    expect(shouldReadNextPhoto([null])).toBe(true);
  });
});

describe('codeRows', () => {
  it('offers every code in both rows, the likelier ones first', () => {
    expect(codeRows(pillarCandidates('B2 C14'))).toEqual({ level: ['B2', 'C14'], bay: ['C14', 'B2'] });
  });

  it('offers a sign whose codes all look like bays for the level too', () => {
    expect(codeRows(pillarCandidates('G3 A2'))).toEqual({ level: ['G3', 'A2'], bay: ['G3', 'A2'] });
  });
});

describe('pickCode', () => {
  const EMPTY = { level: '', bay: '' };
  const TWO = ['G3', 'A2'];

  it('fills the other field with the code left over, either way round', () => {
    expect(pickCode(EMPTY, 'bay', 'G3', TWO)).toEqual({ level: 'A2', bay: 'G3' });
    expect(pickCode(EMPTY, 'level', 'G3', TWO)).toEqual({ level: 'G3', bay: 'A2' });
  });

  it('swaps the two when the other row is tapped', () => {
    expect(pickCode({ level: 'A2', bay: 'G3' }, 'level', 'G3', TWO)).toEqual({ level: 'G3', bay: 'A2' });
  });

  it('keeps a value the user typed in the other field', () => {
    expect(pickCode({ level: 'B1', bay: '' }, 'bay', 'G3', TWO)).toEqual({ level: 'B1', bay: 'G3' });
  });

  it('fills only the field tapped when more than one code is left', () => {
    expect(pickCode(EMPTY, 'bay', 'G3', ['G3', 'A2', '12'])).toEqual({ level: '', bay: 'G3' });
  });

  it('never leaves a code in both fields', () => {
    expect(pickCode({ level: 'G3', bay: '' }, 'bay', 'G3', ['G3', 'A2', '12'])).toEqual({ level: '', bay: 'G3' });
    expect(pickCode({ level: ' g3 ', bay: '' }, 'bay', 'G3', TWO)).toEqual({ level: 'A2', bay: 'G3' });
  });

  it('clears only the field whose chip was tapped again', () => {
    expect(pickCode({ level: 'A2', bay: 'G3' }, 'bay', null, TWO)).toEqual({ level: 'A2', bay: '' });
  });

  it('fills nothing else when only one code was read', () => {
    expect(pickCode(EMPTY, 'level', 'B2', ['B2'])).toEqual({ level: 'B2', bay: '' });
  });

  it.each(['M 12', 'G-3'])('fills nothing else for %p, two readings of the same characters', (sign) => {
    const codes = codeRows(pillarCandidates(sign)).level;

    expect(codes).toHaveLength(2);
    expect(pickCode(EMPTY, 'bay', codes[1], codes)).toEqual({ level: '', bay: codes[1] });
  });

  it('reads a typed value as the sign is read, so a code is not left in both fields', () => {
    expect(pickCode({ level: 'c-14', bay: '' }, 'bay', 'C14', ['B2', 'C14', '7'])).toEqual({ level: '', bay: 'C14' });
  });
});

describe('fillsOther', () => {
  it.each([
    { codes: ['G3', 'A2'], fills: true },
    { codes: ['B2', 'C14'], fills: true },
    { codes: ['M', 'M12'], fills: false },
    { codes: ['G3', 'G'], fills: false },
    { codes: ['B2'], fills: false },
    { codes: ['B2', 'C14', '7'], fills: false },
  ])('is $fills for $codes', ({ codes, fills }) => {
    expect(fillsOther(codes)).toBe(fills);
  });
});
