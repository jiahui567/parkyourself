import { pillarCandidates, shouldReadNextPhoto, suggestionsFromPhotos } from './pillarText';

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
