import { formatMinutes, formatTime } from '../lib/time';
import { parkTimerText, timerStatusText, timerWouldEndText } from './timerText';

// Local phone time (jest.config.js pins Asia/Kuala_Lumpur).
const at = (localDateTime) => new Date(localDateTime).getTime();

describe('parkTimerText', () => {
  it('says Off for no timer', () => {
    expect(parkTimerText(0)).toBe('Off');
  });

  it('gives minutes and whole hours as the other timer choices do', () => {
    expect(parkTimerText(45)).toBe(formatMinutes(45));
    expect(parkTimerText(120)).toBe(formatMinutes(120));
  });

  it('gives hours and minutes together', () => {
    expect(parkTimerText(150)).toBe('2h 30m');
    expect(parkTimerText(65)).toBe('1h 05m');
  });
});

describe('timerWouldEndText', () => {
  it('says when the timer would end', () => {
    const now = at('2026-10-27T15:00');

    expect(timerWouldEndText(now, 150)).toBe(`Ends ${formatTime(at('2026-10-27T17:30'))}`);
  });

  it('says tomorrow for a timer that runs past midnight', () => {
    const now = at('2026-10-27T22:00');

    expect(timerWouldEndText(now, 150)).toBe(`Ends tomorrow ${formatTime(at('2026-10-28T00:30'))}`);
  });

  it('asks for a length while the wheel is at zero', () => {
    expect(timerWouldEndText(at('2026-10-27T15:00'), 0)).toBe('Pick how long');
  });
});

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
