import { visitsText } from './visitsText';

describe('visitsText', () => {
  it.each([
    { count: 0, text: '0 visits' },
    { count: 1, text: '1 visit' },
    { count: 3, text: '3 visits' },
  ])('says $text for $count', ({ count, text }) => {
    expect(visitsText(count)).toBe(text);
  });

  // A count that is not a whole number means the query broke; say so instead of showing it.
  it('refuses a count that is not a whole number of 0 or more', () => {
    expect(() => visitsText(-1)).toThrow('whole number');
    expect(() => visitsText(null)).toThrow('whole number');
  });
});
