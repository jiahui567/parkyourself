import { assertValidRate } from './calcFee';
import {
  EMPTY_RATE_FORM,
  feeFields,
  formFromRate,
  hasMoreRateOptions,
  HOLIDAY_AMOUNT_ERROR,
  holidayRate,
  holidayRateFromText,
  isRateFormEmpty,
  planRateSave,
  rateFromForm,
  sameRate,
} from './rateForm';

// The weekday rate from PLAN.md's fee test table, as typed and as stored.
const WEEKDAY_FORM = {
  ...EMPTY_RATE_FORM,
  firstPrice: '3',
  blockPrice: '2.00',
  graceMinutes: '15',
  dailyCap: 'RM 20',
};
const WEEKDAY = {
  type: 'hourly',
  first_minutes: 60,
  first_sen: 300,
  block_minutes: 60,
  block_sen: 200,
  grace_minutes: 15,
  daily_cap_sen: 2000,
  flat_sen: null,
};
const FLAT = holidayRate(500);

// A place_rate row as the database returns it.
const row = (rate, dayType) => ({
  id: `rate-${dayType}`,
  place_id: 'place-1',
  day_type: dayType,
  ...rate,
  created_at: 1000,
  updated_at: 2000,
  deleted_at: null,
});

describe('rateFromForm', () => {
  it('reads an hourly form into a rate the fee functions accept', () => {
    const { rate, error } = rateFromForm(WEEKDAY_FORM);

    expect(error).toBeNull();
    expect(rate).toEqual(WEEKDAY);
    expect(() => assertValidRate(rate)).not.toThrow();
  });

  it('reads a flat form with its free minutes, ignoring the hidden hourly fields', () => {
    const form = { ...WEEKDAY_FORM, type: 'flat', flatPrice: '5', graceMinutes: '10' };

    expect(rateFromForm(form)).toEqual({ rate: { ...FLAT, grace_minutes: 10 }, error: null });
  });

  it('gives no rate and no error for a form with only the prefilled minutes', () => {
    expect(rateFromForm({ ...EMPTY_RATE_FORM, graceMinutes: '15' })).toEqual({ rate: null, error: null });
  });

  it.each([
    { rule: 'no block price', form: { blockPrice: '' }, error: 'price after the first period' },
    { rule: 'a first period of 0 min', form: { firstMinutes: '0' }, error: 'first period in whole minutes' },
    { rule: 'a block of 1.5 min', form: { blockMinutes: '1.5' }, error: 'each period after in whole minutes' },
    { rule: 'a first price with letters', form: { firstPrice: 'three' }, error: 'first price' },
    { rule: 'free minutes of -5', form: { graceMinutes: '-5' }, error: 'free minutes' },
    { rule: 'a daily max of 0', form: { dailyCap: '0' }, error: 'daily max' },
  ])('refuses a partly filled form: $rule', ({ form, error }) => {
    const result = rateFromForm({ ...WEEKDAY_FORM, ...form });

    expect(result.rate).toBeNull();
    expect(result.error).toContain(error);
  });

  it('names the prices before the fields under More options, in the order the form shows them', () => {
    const result = rateFromForm({ ...WEEKDAY_FORM, firstMinutes: '', blockPrice: '' });

    expect(result.error).toContain('price after the first period');
  });
});

describe('hasMoreRateOptions', () => {
  it.each([
    { rule: 'the empty form', form: EMPTY_RATE_FORM, more: false },
    { rule: 'prices only, with the prefilled hour', form: { ...EMPTY_RATE_FORM, firstPrice: '3', blockPrice: '2' }, more: false },
    { rule: 'free minutes left blank', form: { ...EMPTY_RATE_FORM, graceMinutes: ' ' }, more: false },
    { rule: 'a first period of 30 min', form: { ...EMPTY_RATE_FORM, firstMinutes: '30' }, more: true },
    { rule: 'blocks of 30 min', form: { ...EMPTY_RATE_FORM, blockMinutes: '30' }, more: true },
    { rule: 'a first period cleared', form: { ...EMPTY_RATE_FORM, firstMinutes: ' ' }, more: true },
    { rule: 'a block cleared', form: { ...EMPTY_RATE_FORM, blockMinutes: '' }, more: true },
    { rule: '15 free minutes', form: { ...EMPTY_RATE_FORM, graceMinutes: '15' }, more: true },
    { rule: 'a daily max', form: { ...EMPTY_RATE_FORM, dailyCap: '20' }, more: true },
    { rule: 'a flat rate with free minutes', form: { ...EMPTY_RATE_FORM, type: 'flat', graceMinutes: '10' }, more: true },
    {
      rule: 'a flat rate, ignoring the hidden hourly fields',
      form: { ...EMPTY_RATE_FORM, type: 'flat', firstMinutes: '30', dailyCap: '20' },
      more: false,
    },
  ])('is $more for $rule', ({ form, more }) => {
    expect(hasMoreRateOptions(form)).toBe(more);
  });
});

describe('isRateFormEmpty', () => {
  it('counts only the prices of the chosen type', () => {
    expect(isRateFormEmpty({ ...WEEKDAY_FORM, type: 'flat' })).toBe(true);
    expect(isRateFormEmpty({ ...EMPTY_RATE_FORM, dailyCap: '20' })).toBe(false);
  });
});

describe('formFromRate', () => {
  it.each([
    ['hourly', { ...WEEKDAY, first_minutes: 120, block_minutes: 30 }],
    ['flat', { ...FLAT, grace_minutes: 10 }],
  ])('gives back the same %s rate when read again', (type, rate) => {
    expect(rateFromForm(formFromRate(row(rate, 'weekday'))).rate).toEqual(rate);
  });

  it('shows amounts without the RM prefix, and an empty cap when there is none', () => {
    expect(formFromRate({ ...WEEKDAY, first_sen: 350, daily_cap_sen: null })).toMatchObject({
      firstPrice: '3.50',
      blockPrice: '2.00',
      dailyCap: '',
    });
  });

  it('gives the empty form for no rate', () => {
    expect(formFromRate(null)).toEqual(EMPTY_RATE_FORM);
  });
});

describe('holidayRateFromText', () => {
  it('reads a typed amount as a flat rate per entry', () => {
    expect(holidayRateFromText(' 8 ')).toEqual({ rate: holidayRate(800), error: null });
  });

  it('gives no rate and no error for an amount left blank', () => {
    expect(holidayRateFromText('  ')).toEqual({ rate: null, error: null });
  });

  it('refuses an amount it cannot read', () => {
    expect(holidayRateFromText('8.000')).toEqual({ rate: null, error: HOLIDAY_AMOUNT_ERROR });
  });
});

describe('sameRate', () => {
  it('ignores ids and timestamps, and reads a field left out as unset', () => {
    expect(sameRate(row(holidayRate(800), 'holiday'), { type: 'flat', flat_sen: 800 })).toBe(true);
  });

  it('sees a change in any one fee field', () => {
    expect(sameRate(row(WEEKDAY, 'weekday'), { ...WEEKDAY, daily_cap_sen: null })).toBe(false);
  });
});

describe('feeFields', () => {
  it('keeps only the fee fields, with the column default for grace', () => {
    expect(feeFields({ id: 'x', place_id: 'p', type: 'flat', flat_sen: 800 })).toEqual({
      type: 'flat',
      first_minutes: null,
      first_sen: null,
      block_minutes: null,
      block_sen: null,
      grace_minutes: 0,
      daily_cap_sen: null,
      flat_sen: 800,
    });
  });
});

describe('planRateSave', () => {
  const PROMO = { ...WEEKDAY, first_sen: 100 };
  const saved = { weekday: row(WEEKDAY, 'weekday'), weekend: null, holiday: row(holidayRate(800), 'holiday') };

  it.each([
    { rule: 'a day type with no saved rate is saved without asking', entered: { weekend: WEEKDAY }, plan: { autoSave: ['weekend'] } },
    { rule: 'a changed saved rate is asked about', entered: { weekday: PROMO }, plan: { changed: ['weekday'] } },
    { rule: 'the saved rate typed again needs nothing', entered: { weekday: WEEKDAY }, plan: { unchanged: ['weekday'] } },
    { rule: 'a changed holiday amount is asked about', entered: { holiday: holidayRate(1000) }, plan: { changed: ['holiday'] } },
    { rule: 'a day type left empty is left out', entered: { weekday: null }, plan: {} },
  ])('$rule', ({ entered, plan }) => {
    expect(planRateSave(saved, entered)).toEqual({ autoSave: [], changed: [], unchanged: [], ...plan });
  });

  it('saves every entered rate when the place has none yet', () => {
    expect(planRateSave(null, { weekday: WEEKDAY, weekend: WEEKDAY }).autoSave).toEqual(['weekday', 'weekend']);
  });
});
