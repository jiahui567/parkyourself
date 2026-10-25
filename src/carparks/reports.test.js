import { MAX_REPORT_MINUTES, MAX_REPORT_SEN, readPendingReports, reportRatesFrom } from './reports';

const HOURLY = {
  type: 'hourly',
  first_minutes: 60,
  first_sen: 300,
  block_minutes: 60,
  block_sen: 200,
  grace_minutes: 15,
  daily_cap_sen: null,
  flat_sen: null,
};
const FLAT = { type: 'flat', first_minutes: null, first_sen: null, block_minutes: null, block_sen: null, grace_minutes: 0, daily_cap_sen: null, flat_sen: 500 };

describe('reportRatesFrom', () => {
  it('sends every day type, with the fee fields of each rate or null', () => {
    const { rates, error } = reportRatesFrom({ weekday: { ...HOURLY, id: 'r1', place_id: 'p1' }, weekend: null, holiday: FLAT });

    expect(error).toBeNull();
    expect(rates).toEqual({ weekday: HOURLY, weekend: null, holiday: FLAT });
  });

  it('needs at least one rate', () => {
    expect(reportRatesFrom({ weekday: null, weekend: null, holiday: null })).toEqual({
      rates: null,
      error: 'Fill in at least one rate to report.',
    });
  });

  it.each([
    { problem: 'an hourly holiday rate', rates: { holiday: HOURLY }, error: /^Public holiday rate: A public holiday amount must be a flat price/ },
    { problem: 'a rate the fee rules refuse', rates: { weekday: { ...HOURLY, first_minutes: 0 } }, error: /^Weekday rate: Invalid hourly rate: first_minutes/ },
    { problem: 'a period longer than a day', rates: { weekend: { ...HOURLY, block_minutes: MAX_REPORT_MINUTES + 1 } }, error: 'Weekend rate: A period can be at most 24 hours.' },
    { problem: 'an amount over RM 1,000', rates: { weekday: { ...FLAT, flat_sen: MAX_REPORT_SEN + 1 } }, error: 'Weekday rate: An amount can be at most RM 1,000.00.' },
    { problem: 'a daily cap over RM 1,000', rates: { weekday: { ...HOURLY, daily_cap_sen: MAX_REPORT_SEN + 1 } }, error: 'Weekday rate: An amount can be at most RM 1,000.00.' },
  ])('refuses $problem', ({ rates, error }) => {
    const result = reportRatesFrom(rates);

    expect(result.rates).toBeNull();
    expect(result.error).toMatch(error);
  });

  it('allows the largest period and amount', () => {
    const rates = { weekday: { ...HOURLY, first_minutes: MAX_REPORT_MINUTES, first_sen: MAX_REPORT_SEN } };

    expect(reportRatesFrom(rates).error).toBeNull();
  });
});

describe('readPendingReports', () => {
  // As Supabase sends it, with microseconds.
  const row = { id: 'r1', car_park_id: 'sunway-pyramid', rates: { weekday: HOURLY }, created_at: '2026-10-23T02:00:00.123456+00:00' };

  it('keeps a report the phone can show, with its time in milliseconds', () => {
    expect(readPendingReports([row])).toEqual([
      {
        id: 'r1',
        car_park_id: 'sunway-pyramid',
        rates: { weekday: HOURLY, weekend: null, holiday: null },
        reported_at: Date.parse('2026-10-23T02:00:00.123Z'),
      },
    ]);
  });

  it.each([
    { problem: 'no id', value: { ...row, id: null } },
    { problem: 'no car park', value: { ...row, car_park_id: null } },
    { problem: 'no time', value: { ...row, created_at: 'soon' } },
    { problem: 'rates that are not an object', value: { ...row, rates: 'cheap' } },
    { problem: 'a rate the phone refuses', value: { ...row, rates: { weekday: { ...HOURLY, first_sen: -1 } } } },
  ])('leaves out a report with $problem', ({ value }) => {
    expect(readPendingReports([value, row]).map((r) => r.id)).toEqual(['r1']);
    expect(readPendingReports([value])).toEqual([]);
  });

  it('reads nothing from a download that is not a list', () => {
    expect(readPendingReports(null)).toEqual([]);
    expect(readPendingReports({ rows: [row] })).toEqual([]);
  });
});
