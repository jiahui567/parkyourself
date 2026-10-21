import { formatDate, formatDuration, formatTime, localDateKey, nextLocalMidnight } from './time';

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
