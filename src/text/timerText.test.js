import { timerStatusText } from './timerText';

// Local phone time (jest.config.js pins Asia/Kuala_Lumpur).
const at = (localDateTime) => new Date(localDateTime).getTime();

describe('timerStatusText', () => {
  const end = at('2026-10-27T16:15');

  it('gives the end time and the time left while running', () => {
    expect(timerStatusText(end, at('2026-10-27T15:50'))).toBe('Timer ends 4:15 PM · 0h 25m left');
  });

  it('rounds the time left up to the minute', () => {
    expect(timerStatusText(end, end - 30 * 1000)).toBe('Timer ends 4:15 PM · 0h 01m left');
  });

  it('says when the timer ended once it has passed', () => {
    expect(timerStatusText(end, at('2026-10-27T16:40'))).toBe('Timer ended at 4:15 PM');
  });

  it('is null with no timer', () => {
    expect(timerStatusText(null, end)).toBeNull();
  });
});
