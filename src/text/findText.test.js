import {
  endedFeeText,
  extendTimerText,
  feeSoFarText,
  missingRateHint,
  missingRateTitle,
  stayTimesText,
} from './findText';

// Local phone time (jest.config.js pins Asia/Kuala_Lumpur). 2026-10-23 is a
// Friday, 2026-10-27 a Tuesday.
const at = (localDateTime) => new Date(localDateTime).getTime();

describe('feeSoFarText', () => {
  it('labels the fee so far, estimate included', () => {
    expect(feeSoFarText({ feeSen: 3400, isEstimate: true })).toBe('Fee so far RM 34.00 (estimate)');
  });

  it('is null when there is no fee', () => {
    expect(feeSoFarText(null)).toBeNull();
  });
});

describe('extendTimerText', () => {
  it.each([
    { timer: 'running', timerEndsAt: at('2026-10-27T16:15'), minutes: 30, text: 'Extend timer by 30 min' },
    { timer: 'not set', timerEndsAt: null, minutes: 60, text: 'Start a 1 hour timer' },
  ])('says what the pill does when the timer is $timer', ({ timerEndsAt, minutes, text }) => {
    expect(extendTimerText(timerEndsAt, minutes)).toBe(text);
  });
});

describe('stayTimesText', () => {
  it('gives the end time alone when the stay ends the same day', () => {
    expect(stayTimesText(at('2026-10-27T10:00'), at('2026-10-27T12:10'))).toBe(
      'Tue, 27 Oct 2026, 10:00 AM to 12:10 PM'
    );
  });

  it('gives the end date too when the stay ran past midnight', () => {
    expect(stayTimesText(at('2026-10-23T20:00'), at('2026-10-24T10:00'))).toBe(
      'Fri, 23 Oct 2026, 8:00 PM to Sat, 24 Oct 2026, 10:00 AM'
    );
  });
});

describe('endedFeeText', () => {
  it.each([
    { rule: 'paid the fee', fee_sen: 700, paid_sen: null, text: { paid: 'Paid RM 7.00', calculated: null } },
    {
      rule: 'paid a different amount',
      fee_sen: 700,
      paid_sen: 500,
      text: { paid: 'Paid RM 5.00', calculated: 'Calculated RM 7.00' },
    },
    {
      rule: 'parked free with validation',
      fee_sen: 700,
      paid_sen: 0,
      text: { paid: 'Paid RM 0.00', calculated: 'Calculated RM 7.00' },
    },
    { rule: 'typed an amount with no fee', fee_sen: null, paid_sen: 500, text: { paid: 'Paid RM 5.00', calculated: null } },
  ])('shows what was paid: $rule', ({ fee_sen, paid_sen, text }) => {
    expect(endedFeeText({ fee_sen, paid_sen })).toEqual(text);
  });

  it('is null with neither a fee nor an amount paid', () => {
    expect(endedFeeText({ fee_sen: null, paid_sen: null })).toBeNull();
  });
});

describe('missing rate form', () => {
  it('names the day type and the place in the title', () => {
    expect(missingRateTitle('weekend', 'Pavilion Bukit Jalil')).toBe('Weekend rate for Pavilion Bukit Jalil');
  });

  it('says where the rate is saved and that it can be left empty', () => {
    expect(missingRateHint('Pavilion Bukit Jalil', true, true)).toBe(
      'It is saved to Pavilion Bukit Jalil for next time. Leave it empty to keep the estimate.'
    );
  });

  it('promises no save when the rate is used for this stay only', () => {
    expect(missingRateHint('Pavilion Bukit Jalil', false, true)).toBe(
      'Used for this stay only. Leave it empty to keep the estimate.'
    );
  });

  it('promises no estimate when the stay has no fee without the rate', () => {
    expect(missingRateHint('Pavilion Bukit Jalil', true, false)).toBe(
      "It is saved to Pavilion Bukit Jalil for next time. Leave it empty if you don't know it."
    );
  });
});
