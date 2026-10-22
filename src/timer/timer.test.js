import { extendTimer, reminderTimes, timerEndFrom } from './timer';

// Local phone time (jest.config.js pins Asia/Kuala_Lumpur).
const at = (localDateTime) => new Date(localDateTime).getTime();

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
