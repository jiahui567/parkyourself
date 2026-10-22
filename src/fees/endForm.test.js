import { amountPaidText, missingRateTypes, readEndForm, savesMissingRate, typedRates } from './endForm';
import { EMPTY_RATE_FORM, holidayRate } from './rateForm';
import { snapshotText } from './sessionFee';

// Local phone time (jest.config.js pins Asia/Kuala_Lumpur). 2026-10-23 is a
// Friday, 2026-10-27 a Tuesday, 2026-10-28 a Wednesday, 2026-10-29 a Thursday.
const at = (localDateTime) => new Date(localDateTime).getTime();

// The weekend rate from PLAN.md's fee test table, as typed and as stored.
const WEEKEND_FORM = { ...EMPTY_RATE_FORM, firstPrice: '4.00', blockPrice: '3.00', dailyCap: '25.00' };
const WEEKEND = {
  type: 'hourly',
  first_minutes: 60,
  first_sen: 400,
  block_minutes: 60,
  block_sen: 300,
  grace_minutes: 0,
  daily_cap_sen: 2500,
  flat_sen: null,
};
const WEEKDAY = { ...WEEKEND, first_sen: 300 };
// A first price but no block price yet.
const HALF_TYPED = { ...EMPTY_RATE_FORM, firstPrice: '4.00' };

const ENDED_AT = 1_793_000_000_000;

describe('missingRateTypes', () => {
  const HOLIDAY = ['2026-10-28'];
  const session = (start, rates, place_id = 'place-1') => ({
    place_id,
    started_at: at(start),
    rate_snapshot: snapshotText(rates),
  });

  it.each([
    {
      rule: 'a weekday-only stay ran into Saturday',
      rates: { weekday: WEEKDAY },
      start: '2026-10-23T20:00',
      end: '2026-10-24T10:00',
      asks: ['weekend'],
    },
    {
      rule: 'a holiday-only stay ran into a weekday',
      rates: { holiday: holidayRate(800) },
      start: '2026-10-28T20:00',
      end: '2026-10-29T10:00',
      holidays: HOLIDAY,
      asks: ['weekday'],
    },
    {
      rule: 'a public holiday has no fixed amount',
      rates: { weekday: WEEKDAY },
      start: '2026-10-28T10:00',
      end: '2026-10-28T12:10',
      holidays: HOLIDAY,
      asks: ['weekend'],
    },
    {
      rule: 'the place had no rate at all, on a Tuesday',
      rates: null,
      start: '2026-10-27T10:00',
      end: '2026-10-27T12:10',
      asks: ['weekday'],
    },
    {
      rule: 'the place had no rate at all, Friday into Saturday',
      rates: null,
      start: '2026-10-23T20:00',
      end: '2026-10-24T10:00',
      asks: ['weekday', 'weekend'],
    },
    {
      rule: 'the snapshot had every rate the stay needed',
      rates: { weekday: WEEKDAY, weekend: WEEKEND },
      start: '2026-10-23T20:00',
      end: '2026-10-24T10:00',
      asks: [],
    },
  ])('asks for $asks when $rule', ({ rates, start, end, holidays = [], asks }) => {
    expect(missingRateTypes(session(start, rates), at(end), new Set(holidays))).toEqual(asks);
  });

  it('asks for nothing when the session has no place to save the rate to', () => {
    const noPlace = session('2026-10-27T10:00', null, null);

    expect(missingRateTypes(noPlace, at('2026-10-27T12:10'), new Set())).toEqual([]);
  });
});

describe('savesMissingRate', () => {
  const WEEKDAY_ONLY = { weekday: WEEKDAY, weekend: null, holiday: null };

  it.each([
    { rule: 'the place has no rate for that day type', placeRates: WEEKDAY_ONLY, saves: true },
    { rule: 'the place gained that rate while parked', placeRates: { ...WEEKDAY_ONLY, weekend: WEEKEND }, saves: false },
    { rule: 'the place was deleted while parked', placeRates: null, saves: false },
  ])('is $saves when $rule', ({ placeRates, saves }) => {
    expect(savesMissingRate(placeRates, 'weekend')).toBe(saves);
  });
});

describe('typedRates', () => {
  it('keeps only the rates typed in full', () => {
    const forms = { weekend: WEEKEND_FORM, weekday: HALF_TYPED };

    expect(typedRates(forms, ['weekday', 'weekend'])).toEqual({ weekend: WEEKEND });
  });
});

describe('amountPaidText', () => {
  it('shows the previewed fee until the user edits the field', () => {
    expect(amountPaidText({ feeSen: 3400 }, null)).toBe('34.00');
  });

  it.each(['30.00', ''])('keeps what the user typed (%p) when the fee changes', (typed) => {
    expect(amountPaidText({ feeSen: 3100 }, typed)).toBe(typed);
  });

  it('is empty when there is no fee', () => {
    expect(amountPaidText(null, null)).toBe('');
  });
});

describe('readEndForm', () => {
  const read = (fields) =>
    readEndForm({ endedAt: ENDED_AT, forms: {}, dayTypes: ['weekend'], paidText: '', ...fields });

  it('gives sessions.end the end time, the amount paid and the missing rate typed', () => {
    const { input } = read({ forms: { weekend: WEEKEND_FORM }, paidText: '31.50' });

    expect(input).toEqual({ ended_at: ENDED_AT, paid_sen: 3150, missing_rates: { weekend: WEEKEND } });
  });

  it('sends no missing rate when its form was left empty', () => {
    expect(read({ forms: { weekend: { ...EMPTY_RATE_FORM } } }).input.missing_rates).toBeNull();
  });

  it('reads an empty amount as no amount typed', () => {
    expect(read({ paidText: '  ' }).input.paid_sen).toBeNull();
  });

  it('refuses a half-typed rate and says what is missing for that day type', () => {
    const result = read({ forms: { weekend: HALF_TYPED }, paidText: '34.00' });

    expect(result).toEqual({
      input: null,
      rateErrors: { weekend: 'Enter the block price, such as 2.00.' },
      paidError: null,
    });
  });

  it('refuses an amount paid that cannot be read', () => {
    const result = read({ paidText: '3.505' });

    expect(result).toEqual({ input: null, rateErrors: {}, paidError: 'Enter the amount paid, such as 3.00.' });
  });
});
