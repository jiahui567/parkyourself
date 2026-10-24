import { CHECK_EVERY_MS, isCheckDue } from './schedule';

const NOW = new Date('2026-10-24T09:00').getTime();
const HOUR = 60 * 60 * 1000;

describe('isCheckDue', () => {
  it('checks the first time', () => {
    expect(isCheckDue(null, NOW)).toBe(true);
    expect(isCheckDue(0, NOW)).toBe(true);
  });

  it('waits a day after a check', () => {
    expect(isCheckDue(NOW - 23 * HOUR, NOW)).toBe(false);
    expect(isCheckDue(NOW - CHECK_EVERY_MS, NOW)).toBe(true);
  });

  it('checks again when the clock went back before the last check', () => {
    expect(isCheckDue(NOW + HOUR, NOW)).toBe(true);
  });
});
