import { addPlaceLabel, holidayAmountHint, keepPlaceLabel, rateUpdateQuestion, typedPlaceQuestion } from './parkText';

const PLACE = 'Pavilion Bukit Jalil';

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

describe('holidayAmountHint', () => {
  it('says where to remove a saved amount, since emptying the field still uses it', () => {
    expect(holidayAmountHint(true)).toBe(
      'Filled in from your saved amount. To use the weekend rate instead, remove it in Settings > Places.'
    );
  });

  it('says the weekend rate is used when no amount is saved', () => {
    expect(holidayAmountHint(false)).toBe('With no amount, a public holiday uses the weekend rate above.');
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
