import { chartBars, chartLayout, chartMaxValue } from './chart';

const month = (key, totalSen = 0, sessions = 0) => ({ key, totalSen, sessions });

describe('chartLayout', () => {
  it('fits every bar, centred in its column, inside the plot width', () => {
    const { column, barWidth, spacing, initialSpacing } = chartLayout(300, 12);

    expect(column).toBe(25);
    expect(barWidth).toBe(15);
    expect(spacing).toBe(10);
    // The last bar ends half a gap before the edge.
    expect(initialSpacing + 12 * barWidth + 11 * spacing).toBe(300 - spacing / 2);
  });
});

describe('chartMaxValue', () => {
  it('leaves a fifth of headroom above the highest month, in whole sen', () => {
    expect(chartMaxValue([month('2026-09', 4999), month('2026-10', 1000)])).toBe(5999);
  });

  it('still gives a scale when nothing was spent', () => {
    expect(chartMaxValue([month('2026-09'), month('2026-10')])).toBe(100);
  });
});

describe('chartBars', () => {
  it('labels each month, keeps sen values and marks only the selected month, by colour and label', () => {
    const bold = { fontWeight: '700' };
    const bars = chartBars(
      [month('2026-09', 300, 1), month('2026-10', 1250, 2)],
      '2026-10',
      { selected: 'green', other: 'grey' },
      bold
    );

    expect(bars).toEqual([
      { value: 300, label: 'Sep', frontColor: 'grey' },
      { value: 1250, label: 'Oct', frontColor: 'green', labelTextStyle: bold },
    ]);
  });
});
