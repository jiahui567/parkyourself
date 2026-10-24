import { EMPTY_RATE_FORM, holidayRate } from '../fees';
import {
  addPlaceLabel,
  holidayRateHint,
  keepPlaceLabel,
  listedPlaceHint,
  listedRateHint,
  parkRateRowText,
  photoCodesHint,
  rateUpdateQuestion,
  typedPlaceQuestion,
} from './parkText';

const PLACE = 'Pavilion Bukit Jalil';

describe('listedPlaceHint', () => {
  it('names the area when the list has one', () => {
    expect(listedPlaceHint({ area: 'Cheras, Kuala Lumpur' })).toBe('From the car park list · Cheras, Kuala Lumpur');
    expect(listedPlaceHint({ area: null })).toBe('From the car park list');
  });
});

describe('listedRateHint', () => {
  it('says where the rate came from and when it was checked', () => {
    expect(listedRateHint({ checked_on: '2026-10-24', effective_from: null, notes: null })).toBe(
      'From the car park list (checked Sat, 24 Oct 2026). Check the sign: these rates are saved to this place when you park.'
    );
  });

  it('adds when the rates took effect, and what the list could not show', () => {
    expect(
      listedRateHint({ checked_on: '2026-10-24', effective_from: '2024-01-01', notes: 'Not included: night flat RM10.' })
    ).toBe(
      'From the car park list (checked Sat, 24 Oct 2026, in effect since Mon, 1 Jan 2024). ' +
        'Check the sign: these rates are saved to this place when you park. Not included: night flat RM10.'
    );
  });
});

describe('rateUpdateQuestion', () => {
  it.each([
    { changed: ['weekend'], question: 'Update the saved weekend rate for Pavilion Bukit Jalil?' },
    { changed: ['holiday'], question: 'Update the saved public holiday amount for Pavilion Bukit Jalil?' },
    {
      changed: ['holiday', 'weekend'],
      question: 'Update the saved weekend rate and public holiday amount for Pavilion Bukit Jalil?',
    },
    {
      changed: ['weekday', 'weekend', 'holiday'],
      question: 'Update the saved weekday rate, weekend rate and public holiday amount for Pavilion Bukit Jalil?',
    },
  ])('asks one question for $changed', ({ changed, question }) => {
    expect(rateUpdateQuestion(changed, PLACE)).toBe(question);
  });

  it('asks nothing when no saved rate changed', () => {
    expect(rateUpdateQuestion([], PLACE)).toBeNull();
  });
});

describe('holidayRateHint', () => {
  it('says a saved amount is used and where to change it', () => {
    expect(holidayRateHint(holidayRate(800))).toBe(
      'Today is a public holiday: RM 8.00 per entry is used. Change it in Settings > Places.'
    );
  });

  it('says the weekend rate is used with no amount', () => {
    expect(holidayRateHint(null)).toBe('Today is a public holiday, so the weekend rate below is used.');
  });
});

describe('addPlaceLabel', () => {
  it('names the typed place without the spaces at its ends', () => {
    expect(addPlaceLabel('  Sunway Pyramid ')).toBe('Add "Sunway Pyramid" as a new place');
  });
});

describe('typedPlaceQuestion', () => {
  it('offers a typed name that matches no saved place as a new place', () => {
    expect(typedPlaceQuestion(' Pavilion ')).toBe('Park at "Pavilion" as a new place?');
  });

  it("names the saved place the typed name matches, in the place's own spelling", () => {
    expect(typedPlaceQuestion('pavilion bukit jalil', PLACE)).toBe('Park at "Pavilion Bukit Jalil"?');
  });
});

describe('keepPlaceLabel', () => {
  it('names the place chosen before Change', () => {
    expect(keepPlaceLabel(PLACE)).toBe('Keep "Pavilion Bukit Jalil"');
  });
});

describe('parkRateRowText', () => {
  const FORM = { ...EMPTY_RATE_FORM, firstPrice: '3', blockPrice: '2' };
  const SUMMARY = 'RM 3.00 first hour, then RM 2.00 per hour';

  it.each([
    { rule: 'a weekday rate typed', dayType: 'weekday', form: FORM, label: 'Weekday rate', hint: SUMMARY },
    { rule: 'an empty weekend form', dayType: 'weekend', form: EMPTY_RATE_FORM, label: 'Weekend rate', hint: 'Not set · optional' },
    {
      rule: 'a half-filled form',
      dayType: 'weekday',
      form: { ...EMPTY_RATE_FORM, firstPrice: '3' },
      label: 'Weekday rate',
      hint: 'Not finished · tap to check it',
    },
  ])('shows $rule', ({ dayType, form, label, hint }) => {
    expect(parkRateRowText({ dayType, form })).toEqual({ label, hint });
  });

  describe('on a public holiday', () => {
    const holiday = (overrides) => parkRateRowText({ dayType: 'weekend', form: FORM, holidayOn: true, ...overrides });

    it('shows the amount typed, over a saved one', () => {
      expect(holiday({ holidayAmount: '8', savedHoliday: holidayRate(1000) })).toEqual({
        label: 'Public holiday rate',
        hint: 'RM 8.00 per entry',
      });
    });

    it('shows the saved amount when the field is empty, as the fee uses it', () => {
      expect(holiday({ holidayAmount: ' ', savedHoliday: holidayRate(1000) }).hint).toBe('RM 10.00 per entry');
    });

    it('falls back to the weekend rate with no amount', () => {
      expect(holiday({}).hint).toBe(`Weekend rate: ${SUMMARY}`);
      expect(holiday({ form: EMPTY_RATE_FORM }).hint).toBe('Weekend rate: Not set · optional');
    });

    it('says an amount it cannot read is not finished', () => {
      expect(holiday({ holidayAmount: '8.000' }).hint).toBe('Not finished · tap to check it');
    });

    it('says a half-filled weekend form is not finished, even with an amount, as Save refuses it', () => {
      const form = { ...EMPTY_RATE_FORM, firstPrice: '4' };

      expect(holiday({ form, holidayAmount: '8' }).hint).toBe('Not finished · tap to check it');
    });
  });
});

describe('photoCodesHint', () => {
  it('says one tap does both when two codes were read', () => {
    expect(photoCodesHint(['G3', 'A2'])).toBe('Tap the level or the bay, and the other code fills in.');
  });

  it('offers a single code as either one', () => {
    expect(photoCodesHint(['C14'])).toBe('Tap it as the level or the bay, and type the other below.');
  });

  it.each([
    ['three codes', ['B2', 'C14', '7']],
    ['two readings of the same characters', ['M', 'M12']],
  ])('asks for both taps with %s', (rule, codes) => {
    expect(photoCodesHint(codes)).toBe('Tap the level and the bay, or type them below.');
  });

  it('says the fields were filled in from the photo', () => {
    expect(photoCodesHint(['B2', 'C14'], true)).toBe('Filled in below from the photo. Check it, or tap another code.');
  });
});
