import { enteredRates, offersSameEveryDay, ratesToSave, rateDayTypeFor } from './parkRates';
import { EMPTY_RATE_FORM, holidayRate, holidayRateFromText, rateFromForm } from './rateForm';

// RM 3.00 first hour, then RM 2.00 per hour, as typed.
const FORM = { ...EMPTY_RATE_FORM, firstPrice: '3.00', blockPrice: '2.00' };
const RATE = rateFromForm(FORM).rate;
const NOTHING_SAVED = { weekday: null, weekend: null, holiday: null };

describe('rateDayTypeFor', () => {
  it.each([
    { rule: 'a weekday shows the weekday rate', today: 'weekday', holidayOn: false, shown: 'weekday' },
    { rule: 'a weekend shows the weekend rate', today: 'weekend', holidayOn: false, shown: 'weekend' },
    { rule: 'a weekday switched to public holiday shows the weekend rate', today: 'weekday', holidayOn: true, shown: 'weekend' },
    { rule: 'a day already in the holiday list shows the weekend rate', today: 'holiday', holidayOn: false, shown: 'weekend' },
  ])('$rule', ({ today, holidayOn, shown }) => {
    expect(rateDayTypeFor(today, holidayOn)).toBe(shown);
  });
});

describe('offersSameEveryDay', () => {
  it.each([
    { rule: 'is offered when neither weekday nor weekend has a saved rate', saved: NOTHING_SAVED, offered: true },
    { rule: 'is not offered when the other day type has a saved rate', saved: { ...NOTHING_SAVED, weekend: RATE }, offered: false },
    { rule: 'is not offered when the day type shown has a saved rate', saved: { ...NOTHING_SAVED, weekday: RATE }, offered: false },
  ])('$rule', ({ saved, offered }) => {
    expect(offersSameEveryDay(saved, 'weekday')).toBe(offered);
  });
});

describe('enteredRates', () => {
  const base = { saved: NOTHING_SAVED, dayType: 'weekday', form: FORM };

  it('gives the typed rate for the day type shown', () => {
    expect(enteredRates(base)).toEqual({ entered: { weekday: RATE }, error: null });
  });

  it('adds the same rate for the other day type with Same rate every day', () => {
    expect(enteredRates({ ...base, sameEveryDay: true }).entered).toEqual({ weekday: RATE, weekend: RATE });
  });

  it('ignores Same rate every day once the other day type has a saved rate', () => {
    const saved = { ...NOTHING_SAVED, weekend: RATE };

    expect(enteredRates({ ...base, saved, sameEveryDay: true }).entered).toEqual({ weekday: RATE });
  });

  it('gives no rates for an empty form', () => {
    expect(enteredRates({ ...base, form: EMPTY_RATE_FORM, sameEveryDay: true })).toEqual({ entered: {}, error: null });
  });

  it('passes on the rate form error and no rates', () => {
    const { entered, error } = enteredRates({ ...base, form: { ...FORM, blockPrice: '' } });

    expect(entered).toBeNull();
    expect(error).toBe(rateFromForm({ ...FORM, blockPrice: '' }).error);
  });

  it('adds a typed public holiday amount as a flat rate', () => {
    const { entered } = enteredRates({ ...base, dayType: 'weekend', holidayOn: true, holidayAmount: '8' });

    expect(entered).toEqual({ weekend: RATE, holiday: holidayRate(800) });
  });

  it('ignores the public holiday amount while the holiday is off', () => {
    expect(enteredRates({ ...base, holidayOn: false, holidayAmount: '8.00' }).entered).toEqual({ weekday: RATE });
  });

  // How the amount is read is tested with holidayRateFromText.
  it('passes on the public holiday amount error and no rates', () => {
    expect(enteredRates({ ...base, holidayOn: true, holidayAmount: '8.000' })).toEqual({
      entered: null,
      error: holidayRateFromText('8.000').error,
    });
  });
});

describe('ratesToSave', () => {
  const plan = { autoSave: ['holiday'], changed: ['weekend'], unchanged: ['weekday'] };

  it.each([
    { choice: 'Only this time saves only the rates the place had none of', update: false, saved: ['holiday'] },
    { choice: 'Yes, update also saves the changed rates', update: true, saved: ['holiday', 'weekend'] },
  ])('$choice', ({ update, saved }) => {
    expect(ratesToSave(plan, update)).toEqual(saved);
  });
});
