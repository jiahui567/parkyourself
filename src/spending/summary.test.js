import { amountSen, historyByMonth, monthSummary, monthlyTotals } from './summary';

// Local phone time (jest.config.js pins Asia/Kuala_Lumpur).
const at = (localDateTime) => new Date(localDateTime).getTime();
const HOUR = 60 * 60 * 1000;

// A row as sessions.listHistory returns it (the columns Spending reads): an
// hour at Pavilion in My Myvi costing RM 3.00, unless overridden.
const row = (overrides = {}) => ({
  vehicle_id: 'myvi',
  vehicle_name: 'My Myvi',
  place_id: 'pavilion',
  place_name: 'Pavilion Bukit Jalil',
  started_at: at('2026-11-10T10:00'),
  ended_at: at('2026-11-10T11:00'),
  fee_sen: 300,
  paid_sen: null,
  ...overrides,
});

describe('amountSen', () => {
  it.each([
    { rule: 'the amount paid over the calculated fee', paid_sen: 250, fee_sen: 300, amount: 250 },
    { rule: 'the calculated fee when nothing was paid', paid_sen: null, fee_sen: 300, amount: 300 },
    { rule: 'a paid amount of 0 (free with validation)', paid_sen: 0, fee_sen: 300, amount: 0 },
    { rule: '0 with no fee and nothing paid', paid_sen: null, fee_sen: null, amount: 0 },
  ])('uses $rule', ({ paid_sen, fee_sen, amount }) => {
    expect(amountSen({ paid_sen, fee_sen })).toBe(amount);
  });
});

describe('monthSummary', () => {
  it('adds up the amount, sessions and time parked, counting a session with no fee', () => {
    const summary = monthSummary([
      row({ ended_at: at('2026-11-10T12:00') }),
      row({ paid_sen: 500 }),
      row({ fee_sen: null, ended_at: at('2026-11-10T10:30') }),
    ]);

    expect(summary).toMatchObject({ totalSen: 800, sessions: 3, durationMs: 3.5 * HOUR });
  });

  it('totals each place, highest first, equal totals by name and no place last', () => {
    const summary = monthSummary([
      row({ place_id: null, place_name: null }),
      row({ place_id: 'midvalley', place_name: 'Mid Valley' }),
      row({ place_id: 'ioi', place_name: 'IOI City' }),
      row({ fee_sen: 200 }),
      row(),
    ]);

    expect(summary.byPlace).toEqual([
      { id: 'pavilion', name: 'Pavilion Bukit Jalil', totalSen: 500, sessions: 2 },
      { id: 'ioi', name: 'IOI City', totalSen: 300, sessions: 1 },
      { id: 'midvalley', name: 'Mid Valley', totalSen: 300, sessions: 1 },
      { id: null, name: null, totalSen: 300, sessions: 1 },
    ]);
  });

  it('totals each car, highest first', () => {
    const summary = monthSummary([row(), row({ vehicle_id: 'axia', vehicle_name: 'Axia', fee_sen: 900 })]);

    expect(summary.byVehicle).toEqual([
      { id: 'axia', name: 'Axia', totalSen: 900, sessions: 1 },
      { id: 'myvi', name: 'My Myvi', totalSen: 300, sessions: 1 },
    ]);
  });
});

describe('monthlyTotals', () => {
  it('returns the 12 months up to the chosen one, oldest first, with empty months as 0 and other months left out', () => {
    const rows = [
      row({ started_at: at('2026-11-03T09:00') }),
      row({ started_at: at('2026-11-20T09:00'), fee_sen: 200 }),
      row({ started_at: at('2026-01-31T09:00') }),
      row({ started_at: at('2027-02-01T09:00') }),
    ];
    const empty = (key) => ({ key, totalSen: 0, sessions: 0 });

    expect(monthlyTotals(rows, '2027-01')).toEqual([
      ...['2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'].map(empty),
      { key: '2026-11', totalSen: 500, sessions: 2 },
      ...['2026-12', '2027-01'].map(empty),
    ]);
  });

  it('counts a session in the local month it started', () => {
    // 16:30 UTC on 31 December is 00:30 on 1 January in Malaysia.
    const rows = [row({ started_at: Date.parse('2026-12-31T16:30:00Z') })];

    expect(monthlyTotals(rows, '2027-01', 2)).toEqual([
      { key: '2026-12', totalSen: 0, sessions: 0 },
      { key: '2027-01', totalSen: 300, sessions: 1 },
    ]);
  });
});

describe('historyByMonth', () => {
  it('groups the rows by the local month they started, keeping their order', () => {
    const nov2 = row({ id: 'b', started_at: at('2026-11-02T09:00'), fee_sen: 500 });
    const nov1 = row({ id: 'a', started_at: at('2026-11-01T00:30'), fee_sen: null, paid_sen: 200 });
    const oct = row({ id: 'c', started_at: at('2026-10-31T23:30'), fee_sen: null });

    expect(historyByMonth([nov2, nov1, oct])).toEqual([
      { key: '2026-11', totalSen: 700, sessions: 2, data: [nov2, nov1] },
      { key: '2026-10', totalSen: 0, sessions: 1, data: [oct] },
    ]);
  });

  it('gives no groups for no rows', () => {
    expect(historyByMonth([])).toEqual([]);
  });
});
