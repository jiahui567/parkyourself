import { dayTypeOf } from './dayType';

// Local phone time (jest.config.js pins Asia/Kuala_Lumpur).
const at = (localDateTime) => new Date(localDateTime).getTime();

describe('dayTypeOf', () => {
  it.each([
    ['Monday', '2026-10-26T10:00', 'weekday'],
    ['Friday', '2026-10-23T23:59', 'weekday'],
    ['Saturday', '2026-10-24T00:00', 'weekend'],
    ['Sunday', '2026-10-25T18:00', 'weekend'],
  ])('%s is a %s', (_, time, expected) => {
    expect(dayTypeOf(at(time))).toBe(expected);
  });

  it('returns holiday for a date in the public holiday list', () => {
    expect(dayTypeOf(at('2026-10-28T10:00'), new Set(['2026-10-28']))).toBe('holiday');
  });

  it('returns holiday when a public holiday falls on a weekend', () => {
    expect(dayTypeOf(at('2026-10-24T10:00'), new Set(['2026-10-24']))).toBe('holiday');
  });

  it("uses the phone's local date, not the UTC date", () => {
    // 23:30 Friday in UTC is already 07:30 Saturday in Malaysia.
    expect(dayTypeOf(Date.parse('2026-10-23T23:30:00Z'))).toBe('weekend');
  });
});
