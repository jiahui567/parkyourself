import {
  extendTimer,
  isTimerLength,
  parkTimerEnd,
  reminderTimes,
  splitMinutes,
  timerEndFrom,
  wheelStartMinutes,
} from './timer';

describe('isTimerLength', () => {
  it.each([0, 5, 150, 23 * 60 + 55])('takes %p minutes', (minutes) => {
    expect(isTimerLength(minutes)).toBe(true);
  });

  it.each([-5, 7, 24 * 60, 1.5, '30', null])('refuses %p', (minutes) => {
    expect(isTimerLength(minutes)).toBe(false);
  });
});

describe('wheelStartMinutes', () => {
  const now = new Date('2026-10-27T15:00').getTime();
  const MINUTE = 60 * 1000;

  it('starts at the time left, rounded up to 5 minutes', () => {
    expect(wheelStartMinutes(now + 42 * MINUTE, now, 0)).toBe(45);
    expect(wheelStartMinutes(now + 45 * MINUTE, now, 0)).toBe(45);
  });

  it('starts at the Settings length when the timer ended or there is none', () => {
    expect(wheelStartMinutes(now - MINUTE, now, 150)).toBe(150);
    expect(wheelStartMinutes(null, now, 150)).toBe(150);
  });

  it('starts at 1 hour when Timer when parking is Off', () => {
    expect(wheelStartMinutes(null, now, 0)).toBe(60);
  });

  it('never starts past the end of the wheel', () => {
    expect(wheelStartMinutes(now + 30 * 60 * MINUTE, now, 0)).toBe(23 * 60 + 55);
  });
});

describe('splitMinutes', () => {
  it('gives the hours and minutes columns', () => {
    expect(splitMinutes(150)).toEqual({ hours: 2, minutes: 30 });
    expect(splitMinutes(0)).toEqual({ hours: 0, minutes: 0 });
    expect(splitMinutes(23 * 60 + 55)).toEqual({ hours: 23, minutes: 55 });
  });
});

// Local phone time (jest.config.js pins Asia/Kuala_Lumpur).
const at = (localDateTime) => new Date(localDateTime).getTime();

describe('parkTimerEnd', () => {
  it('starts no timer when Timer when parking is Off', () => {
    expect(parkTimerEnd(at('2026-10-27T10:00'), 0)).toBeNull();
  });

  it('ends the set length after parking', () => {
    expect(parkTimerEnd(at('2026-10-27T10:00'), 120)).toBe(at('2026-10-27T12:00'));
  });

  it('refuses a length that is not whole minutes', () => {
    expect(() => parkTimerEnd(at('2026-10-27T10:00'), 1.5)).toThrow('whole number');
  });
});

describe('timerEndFrom', () => {
  it('ends the chosen minutes after the start', () => {
    expect(timerEndFrom(at('2026-10-27T10:00'), 120)).toBe(at('2026-10-27T12:00'));
  });
});

describe('extendTimer', () => {
  const now = at('2026-10-27T10:00');

  it.each([
    ['no timer yet: starts one from now', null, '2026-10-27T10:30'],
    ['timer still running: adds to its end', at('2026-10-27T10:20'), '2026-10-27T10:50'],
    ['timer already ended: adds to now', at('2026-10-27T09:40'), '2026-10-27T10:30'],
  ])('%s', (_rule, timerEndsAt, expected) => {
    expect(extendTimer(timerEndsAt, now, 30)).toBe(at(expected));
  });

  it.each([0, -15, 7.5, '30'])('rejects %p minutes', (minutes) => {
    expect(() => extendTimer(null, now, minutes)).toThrow('Timer minutes must be a whole number');
  });
});

describe('reminderTimes', () => {
  const end = at('2026-10-27T12:00');

  it('gives the lead-time reminder and the end reminder', () => {
    expect(reminderTimes(end, 10, at('2026-10-27T10:00'))).toEqual([
      { kind: 'before', at: at('2026-10-27T11:50') },
      { kind: 'end', at: end },
    ]);
  });

  it('skips the lead-time reminder when less time is left than the lead', () => {
    expect(reminderTimes(end, 10, at('2026-10-27T11:55'))).toEqual([{ kind: 'end', at: end }]);
  });

  it.each([
    ['once the timer has ended', end],
    ['with no timer', null],
  ])('gives nothing %s', (_case, timerEndsAt) => {
    expect(reminderTimes(timerEndsAt, 10, end)).toEqual([]);
  });
});
