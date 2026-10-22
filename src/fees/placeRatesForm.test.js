import { changedPlaceRates, placeRatesFormFrom, ratesFromPlaceRatesForm } from './placeRatesForm';
import { EMPTY_RATE_FORM, formFromRate, holidayRateFromText, sameRate } from './rateForm';

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
const WEEKEND = {
  type: 'flat',
  first_minutes: null,
  first_sen: null,
  block_minutes: null,
  block_sen: null,
  grace_minutes: 0,
  daily_cap_sen: null,
  flat_sen: 500,
};
const HOLIDAY = { ...WEEKEND, flat_sen: 800 };

const EMPTY_FORM = { weekday: { ...EMPTY_RATE_FORM }, weekend: { ...EMPTY_RATE_FORM }, holidayAmount: '' };

describe('placeRatesFormFrom', () => {
  it('prefills each form from its saved rate and the holiday amount in ringgit', () => {
    expect(placeRatesFormFrom({ weekday: WEEKDAY, weekend: WEEKEND, holiday: HOLIDAY })).toEqual({
      weekday: formFromRate(WEEKDAY),
      weekend: formFromRate(WEEKEND),
      holidayAmount: '8.00',
    });
  });

  it('leaves the forms and the amount empty for rates not saved', () => {
    expect(placeRatesFormFrom({ weekday: null, weekend: null, holiday: null })).toEqual(EMPTY_FORM);
  });
});

describe('ratesFromPlaceRatesForm', () => {
  it('gives back the saved rates when nothing was changed', () => {
    const { rates, error } = ratesFromPlaceRatesForm(
      placeRatesFormFrom({ weekday: WEEKDAY, weekend: WEEKEND, holiday: HOLIDAY })
    );

    expect(error).toBeNull();
    expect(sameRate(rates.weekday, WEEKDAY)).toBe(true);
    expect(sameRate(rates.weekend, WEEKEND)).toBe(true);
    expect(sameRate(rates.holiday, HOLIDAY)).toBe(true);
  });

  // places.saveDetails removes a day type's saved rate when it gets null.
  it('turns empty forms and an empty amount into null, so the saved rates are removed', () => {
    expect(ratesFromPlaceRatesForm({ ...EMPTY_FORM, holidayAmount: '  ' })).toEqual({
      rates: { weekday: null, weekend: null, holiday: null },
      error: null,
    });
  });

  it('names the rate a form error belongs to, checking the weekday first', () => {
    const partly = { ...EMPTY_RATE_FORM, blockPrice: '2.00' };

    expect(ratesFromPlaceRatesForm({ weekday: partly, weekend: partly, holidayAmount: '' })).toEqual({
      rates: null,
      error: 'Weekday rate: Enter the first price, such as 3.00.',
    });
  });

  it('names the weekend rate when only that form has an error', () => {
    const form = { ...EMPTY_FORM, weekend: { ...EMPTY_RATE_FORM, firstPrice: '3.00' } };

    expect(ratesFromPlaceRatesForm(form).error).toBe('Weekend rate: Enter the block price, such as 2.00.');
  });

  // How the amount is read is tested with holidayRateFromText.
  it('passes on the holiday amount error and no rates', () => {
    expect(ratesFromPlaceRatesForm({ ...EMPTY_FORM, holidayAmount: '5.555' })).toEqual({
      rates: null,
      error: holidayRateFromText('5.555').error,
    });
  });
});

describe('changedPlaceRates', () => {
  it('keeps only the day types whose rate was changed, added or cleared', () => {
    const saved = { weekday: { ...WEEKDAY, id: 'r1', place_id: 'p1' }, weekend: WEEKEND, holiday: null };
    const typed = { weekday: { ...WEEKDAY }, weekend: null, holiday: HOLIDAY };

    expect(changedPlaceRates(saved, typed)).toEqual({ weekend: null, holiday: HOLIDAY });
  });

  it('is empty when no rate is saved and none was typed', () => {
    const none = { weekday: null, weekend: null, holiday: null };

    expect(changedPlaceRates(none, none)).toEqual({});
  });
});
