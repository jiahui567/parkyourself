import {
  amountText,
  chartRangeText,
  chartSummaryText,
  emptyMonthText,
  monthStatsText,
  noSessionsText,
  placeLabel,
  sessionCountText,
  totalLineText,
} from './spendingText';

const HOUR = 60 * 60 * 1000;
const month = (key, totalSen = 0, sessions = 0) => ({ key, totalSen, sessions });

describe('sessionCountText', () => {
  it.each([
    { count: 0, text: '0 sessions' },
    { count: 1, text: '1 session' },
    { count: 3, text: '3 sessions' },
  ])('$count -> $text', ({ count, text }) => {
    expect(sessionCountText(count)).toBe(text);
  });
});

describe('monthStatsText', () => {
  it('gives the sessions and time parked', () => {
    expect(monthStatsText({ sessions: 3, durationMs: 4.5 * HOUR })).toBe('3 sessions · 4h 30m parked');
  });
});

describe('totalLineText', () => {
  it('gives the total and the sessions', () => {
    expect(totalLineText({ totalSen: 4500, sessions: 1 })).toBe('RM 45.00 · 1 session');
  });
});

describe('placeLabel', () => {
  it('names the group of sessions with no place', () => {
    expect(placeLabel({ id: null, name: null })).toBe('No place');
  });

  it('uses the place name', () => {
    expect(placeLabel({ id: 'pavilion', name: 'Pavilion Bukit Jalil' })).toBe('Pavilion Bukit Jalil');
  });
});

describe('empty lists', () => {
  it('says a month had no parking', () => {
    expect(emptyMonthText('2026-10')).toBe('No parking in Oct 2026.');
  });

  it('says a place or car had no parking that month', () => {
    expect(noSessionsText('2026-10')).toBe('No parking here in Oct 2026.');
  });
});

describe('chartRangeText', () => {
  it('names the first and last month', () => {
    expect(chartRangeText([month('2025-11'), month('2025-12'), month('2026-10')])).toBe('Nov 2025 to Oct 2026');
  });
});

describe('chartSummaryText', () => {
  it('gives the total and the highest month, the first of equal ones', () => {
    const totals = [month('2025-11', 3000, 2), month('2026-03', 3000, 1), month('2026-10', 1500, 1)];

    expect(chartSummaryText(totals)).toBe(
      'Spending by month, Nov 2025 to Oct 2026. Total RM 75.00. Highest: Nov 2025, RM 30.00.'
    );
  });

  it('says when there was no parking', () => {
    expect(chartSummaryText([month('2025-11'), month('2026-10')])).toBe(
      'Spending by month, Nov 2025 to Oct 2026. No parking.'
    );
  });

  it('gives no highest month when every session was free', () => {
    expect(chartSummaryText([month('2025-11', 0, 2), month('2026-10')])).toBe(
      'Spending by month, Nov 2025 to Oct 2026. Total RM 0.00.'
    );
  });
});

// Which amount is used is amountSen's rule (src/spending/summary.test.js);
// these cases cover only when amountText shows nothing.
describe('amountText', () => {
  it.each([
    { rule: 'a free stay', fee_sen: 0, paid_sen: null, text: 'RM 0.00' },
    { rule: 'the amount paid when no fee was calculated', fee_sen: null, paid_sen: 500, text: 'RM 5.00' },
    { rule: 'nothing when no fee is known', fee_sen: null, paid_sen: null, text: null },
  ])('shows $rule', ({ fee_sen, paid_sen, text }) => {
    expect(amountText({ fee_sen, paid_sen })).toBe(text);
  });
});
