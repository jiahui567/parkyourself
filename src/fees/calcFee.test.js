import { assertValidRate, calcDayFeeSen, calcStayFee, stayDayTypes } from './calcFee';

// Local phone time (jest.config.js pins Asia/Kuala_Lumpur). 2026-10-23 is a
// Friday, 2026-10-24 a Saturday, 2026-10-27 a Tuesday, 2026-10-28 a Wednesday,
// 2026-10-29 a Thursday.
const at = (localDateTime) => new Date(localDateTime).getTime();
const MINUTE = 60 * 1000;

// The rates from PLAN.md's fee test table.
const WEEKDAY = {
  type: 'hourly',
  first_minutes: 60,
  first_sen: 300,
  block_minutes: 60,
  block_sen: 200,
  grace_minutes: 15,
  daily_cap_sen: 2000,
};
const WEEKEND = {
  type: 'hourly',
  first_minutes: 60,
  first_sen: 400,
  block_minutes: 60,
  block_sen: 300,
  grace_minutes: 0,
  daily_cap_sen: 2500,
};
const HOLIDAY_RM8 = { type: 'flat', flat_sen: 800, grace_minutes: 0, daily_cap_sen: null };
const RATES = { weekday: WEEKDAY, weekend: WEEKEND };

describe('PLAN.md fee test table', () => {
  it.each([
    { stay: 'Tuesday, 10 min (grace)', start: '2026-10-27T10:00', end: '2026-10-27T10:10', fee: 0 },
    { stay: 'Tuesday, 45 min', start: '2026-10-27T10:00', end: '2026-10-27T10:45', fee: 300 },
    { stay: 'Tuesday, 1 h 00 min', start: '2026-10-27T10:00', end: '2026-10-27T11:00', fee: 300 },
    { stay: 'Tuesday, 1 h 01 min', start: '2026-10-27T10:00', end: '2026-10-27T11:01', fee: 500 },
    { stay: 'Tuesday, 2 h 10 min', start: '2026-10-27T10:00', end: '2026-10-27T12:10', fee: 700 },
    { stay: 'Tuesday 09:00 to 21:00 (cap)', start: '2026-10-27T09:00', end: '2026-10-27T21:00', fee: 2000 },
    { stay: 'Saturday, 2 h 10 min', start: '2026-10-24T10:00', end: '2026-10-24T12:10', fee: 1000 },
    {
      stay: 'Public holiday on a Wednesday, no holiday amount saved, 2 h 10 min',
      start: '2026-10-28T10:00',
      end: '2026-10-28T12:10',
      holidays: ['2026-10-28'],
      fee: 1000,
    },
    {
      stay: 'Public holiday, fixed holiday amount RM 8.00 saved, 5 h',
      start: '2026-10-28T10:00',
      end: '2026-10-28T15:00',
      holidays: ['2026-10-28'],
      holidayRate: HOLIDAY_RM8,
      fee: 800,
    },
    { stay: 'Friday 20:00 to Saturday 10:00', start: '2026-10-23T20:00', end: '2026-10-24T10:00', fee: 3400 },
  ])('$stay: $fee sen', ({ start, end, holidays = [], holidayRate, fee }) => {
    const rates = { ...RATES, holiday: holidayRate };
    expect(calcStayFee(at(start), at(end), rates, new Set(holidays)).feeSen).toBe(fee);
  });
});

describe('calcStayFee', () => {
  it('prices each day of an overnight stay on its own and labels it an estimate', () => {
    const result = calcStayFee(at('2026-10-23T20:00'), at('2026-10-24T10:00'), RATES);

    expect(result).toMatchObject({ feeSen: 3400, isEstimate: true, overnight: true, missingRates: [] });
    expect(result.days).toEqual([
      { date: '2026-10-23', dayType: 'weekday', rateDayType: 'weekday', durationMs: 240 * MINUTE, feeSen: 900, capped: false },
      { date: '2026-10-24', dayType: 'weekend', rateDayType: 'weekend', durationMs: 600 * MINUTE, feeSen: 2500, capped: true },
    ]);
  });

  it('gives an exact, non-estimate fee for a same-day stay', () => {
    const result = calcStayFee(at('2026-10-27T10:00'), at('2026-10-27T12:10'), RATES);

    expect(result).toMatchObject({ feeSen: 700, isEstimate: false, overnight: false, withinGrace: false });
  });

  it.each([
    [10, 0],
    [20, 500],
  ])('gives a flat rate its free minutes too: %i min of RM 5.00 with 15 free costs %i sen', (minutes, fee) => {
    const flat = { type: 'flat', flat_sen: 500, grace_minutes: 15, daily_cap_sen: null };
    const start = at('2026-10-27T10:00');

    expect(calcStayFee(start, start + minutes * MINUTE, { weekday: flat }).feeSen).toBe(fee);
  });

  it('charges a started block in full, to the millisecond', () => {
    const start = at('2026-10-27T10:00');

    expect(calcStayFee(start, start + 60 * MINUTE + 30 * 1000, RATES).feeSen).toBe(500);
  });

  it('uses the weekend rate on a public holiday with no holiday amount, without calling it an estimate', () => {
    const result = calcStayFee(at('2026-10-28T10:00'), at('2026-10-28T12:10'), RATES, new Set(['2026-10-28']));

    expect(result.days[0]).toMatchObject({ dayType: 'holiday', rateDayType: 'weekend' });
    expect(result.isEstimate).toBe(false);
  });

  it('uses the holiday amount when a public holiday falls on a weekend', () => {
    const rates = { ...RATES, holiday: HOLIDAY_RM8 };
    const result = calcStayFee(at('2026-10-24T10:00'), at('2026-10-24T15:00'), rates, new Set(['2026-10-24']));

    expect(result.feeSen).toBe(800);
    expect(result.days[0].rateDayType).toBe('holiday');
  });

  it('borrows the weekday rate when the weekend rate is missing, and labels it an estimate', () => {
    const result = calcStayFee(at('2026-10-24T10:00'), at('2026-10-24T12:10'), { weekday: WEEKDAY });

    expect(result).toMatchObject({ feeSen: 700, isEstimate: true, missingRates: ['weekend'] });
    expect(result.days[0].rateDayType).toBe('weekday');
  });

  it('borrows the weekend rate when the weekday rate is missing', () => {
    const result = calcStayFee(at('2026-10-27T10:00'), at('2026-10-27T12:10'), { weekend: WEEKEND });

    expect(result).toMatchObject({ feeSen: 1000, isEstimate: true, missingRates: ['weekday'] });
  });

  it('returns a null fee when the place has no weekday or weekend rate', () => {
    const result = calcStayFee(at('2026-10-27T10:00'), at('2026-10-27T12:10'), { holiday: HOLIDAY_RM8 });

    expect(result.feeSen).toBeNull();
  });

  it('does not add a next-day part when the stay ends exactly at midnight', () => {
    const result = calcStayFee(at('2026-10-27T22:00'), at('2026-10-28T00:00'), RATES);

    expect(result).toMatchObject({ feeSen: 500, overnight: false, isEstimate: false });
    expect(result.days).toHaveLength(1);
  });

  it("applies the first day's grace period to a short stay across midnight", () => {
    const result = calcStayFee(at('2026-10-23T23:55'), at('2026-10-24T00:05'), RATES);

    expect(result).toMatchObject({ feeSen: 0, withinGrace: true, overnight: true, isEstimate: false });
  });

  it('treats a zero-length stay as free', () => {
    const start = at('2026-10-27T10:00');

    expect(calcStayFee(start, start, RATES)).toMatchObject({ feeSen: 0, withinGrace: true });
  });

  it('charges a flat rate once per day, whatever the duration', () => {
    const flat = { type: 'flat', flat_sen: 500, grace_minutes: 0 };

    expect(calcStayFee(at('2026-10-27T08:00'), at('2026-10-27T20:00'), { weekday: flat }).feeSen).toBe(500);
  });

  it('rejects a stay that ends before it starts', () => {
    expect(() => calcStayFee(at('2026-10-27T12:00'), at('2026-10-27T10:00'), RATES)).toThrow('cannot end before');
  });

  it('rejects times that are not epoch milliseconds', () => {
    expect(() => calcStayFee('2026-10-27', at('2026-10-27T10:00'), RATES)).toThrow('epoch milliseconds');
  });
});

describe('stayDayTypes', () => {
  it('gives the day type of each local day the stay covers, holidays included', () => {
    const days = stayDayTypes(at('2026-10-27T22:00'), at('2026-10-29T10:00'), new Set(['2026-10-28']));

    expect(days).toEqual(['weekday', 'holiday', 'weekday']);
  });
});

describe('calcDayFeeSen', () => {
  it('applies the daily cap', () => {
    expect(calcDayFeeSen(12 * 60 * MINUTE, WEEKDAY)).toBe(2000);
  });

  it('has no cap when daily_cap_sen is null', () => {
    expect(calcDayFeeSen(12 * 60 * MINUTE, { ...WEEKDAY, daily_cap_sen: null })).toBe(2500);
  });
});

describe('assertValidRate', () => {
  it.each([
    ['an unknown type', { type: 'daily' }, 'Unknown rate type'],
    ['an hourly rate without block_minutes', { ...WEEKDAY, block_minutes: null }, 'block_minutes'],
    ['an hourly rate with a negative first_sen', { ...WEEKDAY, first_sen: -100 }, 'first_sen'],
    ['a flat rate without flat_sen', { type: 'flat', grace_minutes: 0 }, 'flat_sen'],
    ['a daily cap of 0', { ...WEEKDAY, daily_cap_sen: 0 }, 'daily_cap_sen'],
    ['a fractional grace period', { ...WEEKDAY, grace_minutes: 1.5 }, 'grace_minutes'],
  ])('rejects %s', (_, rate, message) => {
    expect(() => assertValidRate(rate)).toThrow(message);
  });

  it('accepts the rates used in PLAN.md', () => {
    expect(() => [WEEKDAY, WEEKEND, HOLIDAY_RM8].forEach(assertValidRate)).not.toThrow();
  });
});
