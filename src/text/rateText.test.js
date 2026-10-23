import { calcStayFee } from '../fees';
import { blockPriceLabel, firstPriceLabel, missingRateText, moreOptionsLabel, rateSummary } from './rateText';

// Local phone time (jest.config.js pins Asia/Kuala_Lumpur). 2026-10-24 is a Saturday.
const at = (localDateTime) => new Date(localDateTime).getTime();

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

describe('rateSummary', () => {
  it.each([
    {
      rate: 'an hourly rate with grace and cap',
      value: WEEKDAY,
      text: 'RM 3.00 first hour, then RM 2.00 per hour · 15 min free · max RM 20.00 a day',
    },
    {
      rate: 'periods other than one hour',
      value: { ...WEEKDAY, first_minutes: 120, block_minutes: 30, grace_minutes: 0, daily_cap_sen: null },
      text: 'RM 3.00 first 2 hours, then RM 2.00 per 30 min',
    },
    {
      rate: 'a flat rate',
      value: { type: 'flat', flat_sen: 500, grace_minutes: 0, daily_cap_sen: null },
      text: 'RM 5.00 per entry',
    },
  ])('describes $rate', ({ value, text }) => {
    expect(rateSummary(value)).toBe(text);
  });

  it('is null for no rate', () => {
    expect(rateSummary(null)).toBeNull();
  });
});

describe('missingRateText', () => {
  it.each([
    [['weekend'], 'Estimate uses the weekday rate'],
    [['weekday'], 'Estimate uses the weekend rate'],
  ])('names the rate borrowed when %p is missing', (missingRates, text) => {
    expect(missingRateText({ feeSen: 2900, isEstimate: true, missingRates })).toBe(text);
  });

  it('is null when no rate was missing', () => {
    expect(missingRateText({ feeSen: 3400, isEstimate: true, missingRates: [] })).toBeNull();
  });

  it('is null for a free stay within the grace period, which is no estimate', () => {
    // 10 minutes on a Saturday with only the weekday rate (15 min free).
    const fee = calcStayFee(at('2026-10-24T10:00'), at('2026-10-24T10:10'), { weekday: WEEKDAY });

    expect(fee).toMatchObject({ feeSen: 0, missingRates: ['weekend'] });
    expect(missingRateText(fee)).toBeNull();
  });
});

describe('price labels', () => {
  it.each([
    { minutes: '60', first: 'First hour (RM)', block: 'Each hour after (RM)' },
    { minutes: ' 30 ', first: 'First 30 min (RM)', block: 'Each 30 min after (RM)' },
    { minutes: '120', first: 'First 2 hours (RM)', block: 'Each 2 hours after (RM)' },
    { minutes: '', first: 'First period (RM)', block: 'Each period after (RM)' },
    { minutes: '0', first: 'First period (RM)', block: 'Each period after (RM)' },
    { minutes: '1.5', first: 'First period (RM)', block: 'Each period after (RM)' },
  ])('follow a period typed as "$minutes"', ({ minutes, first, block }) => {
    expect(firstPriceLabel(minutes)).toBe(first);
    expect(blockPriceLabel(minutes)).toBe(block);
  });
});

describe('moreOptionsLabel', () => {
  it('folds back while open', () => {
    expect(moreOptionsLabel(true, 2)).toBe('Fewer options');
  });

  it('says how many hidden fields are set', () => {
    expect(moreOptionsLabel(false, 2)).toBe('More options · 2 set');
  });

  it('is plain with nothing hidden', () => {
    expect(moreOptionsLabel(false, 0)).toBe('More options');
  });
});
