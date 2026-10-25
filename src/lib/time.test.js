import {
  addMonths,
  formatDate,
  formatDateKey,
  formatDuration,
  formatMinutes,
  formatMonth,
  formatMonthShort,
  formatTime,
  isDateKey,
  localDateKey,
  localMonthKey,
  monthRange,
  nextLocalMidnight,
  parseServerTime,
} from './time';

// Local phone time (jest.config.js pins Asia/Kuala_Lumpur).
const at = (localDateTime) => new Date(localDateTime).getTime();
const MINUTE = 60 * 1000;

describe('localDateKey', () => {
  it('formats the local calendar day', () => {
    expect(localDateKey(at('2026-03-05T23:59'))).toBe('2026-03-05');
  });

  it("uses the phone's local date, not the UTC date", () => {
    // 16:30 UTC on the 23rd is 00:30 on the 24th in Malaysia.
    expect(localDateKey(Date.parse('2026-10-23T16:30:00Z'))).toBe('2026-10-24');
  });
});

describe('nextLocalMidnight', () => {
  it('returns the coming midnight', () => {
    expect(nextLocalMidnight(at('2026-10-23T20:00'))).toBe(at('2026-10-24T00:00'));
  });

  it('returns the next day when given a midnight', () => {
    expect(nextLocalMidnight(at('2026-10-24T00:00'))).toBe(at('2026-10-25T00:00'));
  });

  it('crosses month and year ends', () => {
    expect(nextLocalMidnight(at('2026-12-31T23:00'))).toBe(at('2027-01-01T00:00'));
  });
});

describe('formatTime', () => {
  it.each([
    ['2026-10-23T14:15', '2:15 PM'],
    ['2026-10-23T00:05', '12:05 AM'],
    ['2026-10-23T12:00', '12:00 PM'],
    ['2026-10-23T09:07', '9:07 AM'],
  ])('%s -> %s', (time, text) => {
    expect(formatTime(at(time))).toBe(text);
  });
});

describe('formatDate', () => {
  it('formats weekday, day, month and year', () => {
    expect(formatDate(at('2026-10-23T14:15'))).toBe('Fri, 23 Oct 2026');
  });
});

describe('isDateKey', () => {
  it.each(['2026-12-25', '2028-02-29'])('accepts %s', (text) => {
    expect(isDateKey(text)).toBe(true);
  });

  it.each(['2026-02-30', '2027-02-29', '2026-13-01', '2026-1-05', '25/12/2026', '', null])('rejects %p', (text) => {
    expect(isDateKey(text)).toBe(false);
  });
});

describe('formatDateKey', () => {
  it('formats a holiday date like formatDate', () => {
    expect(formatDateKey('2026-12-25')).toBe('Fri, 25 Dec 2026');
  });
});

describe('months', () => {
  it("uses the phone's local month, not the UTC month", () => {
    // 16:30 UTC on 31 October is 00:30 on 1 November in Malaysia.
    expect(localMonthKey(Date.parse('2026-10-31T16:30:00Z'))).toBe('2026-11');
  });

  it.each([
    ['2026-10', 1, '2026-11'],
    ['2026-12', 1, '2027-01'],
    ['2026-01', -1, '2025-12'],
    ['2026-10', -11, '2025-11'],
  ])('addMonths(%s, %i) -> %s', (key, n, expected) => {
    expect(addMonths(key, n)).toBe(expected);
  });

  it('gives a month as local midnights, end exclusive', () => {
    expect(monthRange('2026-12')).toEqual({ start: at('2026-12-01T00:00'), end: at('2027-01-01T00:00') });
  });

  it('formats a month', () => {
    expect(formatMonth('2026-10')).toBe('Oct 2026');
    expect(formatMonthShort('2026-10')).toBe('Oct');
  });

  it.each(['2026-13', '2026-00', '2026-1', 'Oct'])('rejects the month %p', (key) => {
    expect(() => monthRange(key)).toThrow('Not a month');
  });
});

describe('formatMinutes', () => {
  it.each([
    [30, '30 min'],
    [60, '1 hour'],
    [120, '2 hours'],
    [90, '90 min'],
  ])('%i -> %s', (minutes, text) => {
    expect(formatMinutes(minutes)).toBe(text);
  });
});

describe('formatDuration', () => {
  it.each([
    [0, '0h 00m'],
    [5 * MINUTE, '0h 05m'],
    [130 * MINUTE + 59 * 1000, '2h 10m'],
    [26 * 60 * MINUTE + 30 * MINUTE, '26h 30m'],
  ])('%i ms -> %s', (ms, text) => {
    expect(formatDuration(ms)).toBe(text);
  });

  it('rejects a negative duration', () => {
    expect(() => formatDuration(-1)).toThrow('zero or more');
  });
});

describe('parseServerTime', () => {
  it.each([
    ['2026-10-25T15:45:40.443816+00:00', '2026-10-25T15:45:40.443Z'],
    ['2026-10-25T15:45:40+00:00', '2026-10-25T15:45:40.000Z'],
    ['2026-10-25T15:45:40.5Z', '2026-10-25T15:45:40.500Z'],
    ['2026-10-25T23:45:40.123+08:00', '2026-10-25T15:45:40.123Z'],
    ['2026-10-25T10:45:40-0500', '2026-10-25T15:45:40.000Z'],
  ])('reads %s', (text, utc) => {
    expect(parseServerTime(text)).toBe(Date.parse(utc));
  });

  it.each(['soon', '2026-10-25', '2026-10-25 15:45:40', '', null])('is NaN for %p', (text) => {
    expect(parseServerTime(text)).toBeNaN();
  });
});
