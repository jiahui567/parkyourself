import { chartRange, chartWindowEnd, hasNextMonth, requestedMonth, spendingView } from './monthView';

// Local phone time (jest.config.js pins Asia/Kuala_Lumpur).
const at = (localDateTime) => new Date(localDateTime).getTime();

// A row as sessions.listHistory returns it (the columns Spending reads),
// started at startedAt (epoch ms): an hour costing RM 3.00.
const row = (startedAt, overrides = {}) => ({
  vehicle_id: 'myvi',
  vehicle_name: 'My Myvi',
  place_id: 'pavilion',
  place_name: 'Pavilion Bukit Jalil',
  started_at: startedAt,
  ended_at: startedAt + 60 * 60 * 1000,
  fee_sen: 300,
  paid_sen: null,
  ...overrides,
});

describe('chartWindowEnd', () => {
  it.each([
    { rule: 'keeps the months when the pick is the last bar', selected: '2026-10', end: '2026-10', next: '2026-10' },
    { rule: 'keeps the months when the pick is the first bar', selected: '2025-11', end: '2026-10', next: '2026-10' },
    { rule: 'moves back one month for the month before the first bar', selected: '2025-10', end: '2026-10', next: '2026-09' },
    { rule: 'moves forward to a pick after the last bar', selected: '2025-12', end: '2025-11', next: '2025-12' },
    { rule: 'shows a pick far in the past as the first bar', selected: '2024-03', end: '2026-10', next: '2025-02' },
  ])('$rule', ({ selected, end, next }) => {
    expect(chartWindowEnd(selected, end)).toBe(next);
  });
});

describe('chartRange', () => {
  it('runs from local midnight on the 1st, 11 months back, to the end of the last month', () => {
    expect(chartRange('2026-10')).toEqual({ from: at('2025-11-01T00:00'), to: at('2026-11-01T00:00') });
  });
});

describe('hasNextMonth', () => {
  it.each([
    { month: '2026-09', current: '2026-10', next: true },
    { month: '2026-10', current: '2026-10', next: false },
    { month: '2025-12', current: '2026-01', next: true },
  ])('$month with the current month $current: $next', ({ month, current, next }) => {
    expect(hasNextMonth(month, current)).toBe(next);
  });
});

describe('spendingView', () => {
  it('sums only the chosen month, counting a session in the local month it started', () => {
    const rows = [
      row(at('2026-10-31T23:30')),
      row(at('2026-10-05T10:00'), { paid_sen: 500 }),
      // 00:30 on 1 Nov in Kuala Lumpur, though still 31 Oct in UTC.
      row(Date.parse('2026-10-31T16:30:00Z')),
      row(at('2026-09-12T10:00')),
    ];

    const { summary } = spendingView(rows, '2026-10', '2026-11');

    expect(summary).toMatchObject({ totalSen: 800, sessions: 2 });
  });

  it('gives 12 chart months ending at the chart end, not at the chosen month', () => {
    const { totals } = spendingView([row(at('2026-09-12T10:00'))], '2026-09', '2026-10');

    expect(totals).toHaveLength(12);
    expect(totals[0].key).toBe('2025-11');
    expect(totals[11].key).toBe('2026-10');
    expect(totals[10]).toEqual({ key: '2026-09', totalSen: 300, sessions: 1 });
  });
});

describe('requestedMonth', () => {
  it.each([
    { param: '2026-09', month: '2026-09' },
    { param: '2026-10', month: '2026-10' },
    { param: '2026-11', month: null },
    { param: '2026-13', month: null },
    { param: '2026-9', month: null },
    { param: undefined, month: null },
    { param: ['2026-09'], month: null },
  ])('reads $param in Oct 2026 as $month', ({ param, month }) => {
    expect(requestedMonth(param, '2026-10')).toBe(month);
  });
});
