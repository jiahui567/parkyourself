import { formatMonthShort } from '../lib/time';

// Sizes and bars for the Spending tab's 12-month BarChart
// (react-native-gifted-charts). Values stay in whole sen.

// Every month gets an equal column of the plot width with its bar centred in
// it, so all bars fit without scrolling and a column is the tap target.
export function chartLayout(plotWidth, count) {
  const column = plotWidth / count;
  const barWidth = Math.floor(column * 0.6);
  const spacing = column - barWidth;
  return { column, barWidth, spacing, initialSpacing: spacing / 2 };
}

// The top of the scale in sen: the highest month plus a fifth, so the tallest
// bar stays clear of the top rule. An empty year still gets a scale.
export function chartMaxValue(totals) {
  const highest = Math.max(0, ...totals.map((month) => month.totalSen));
  return Math.max(100, Math.ceil((highest * 6) / 5));
}

// BarChart data: one bar per month, the selected month in its own colour and
// with its own label style. On the light card the two bar colours are almost
// equally bright, so the label is the cue that does not depend on colour.
export function chartBars(totals, selectedKey, { selected, other }, selectedLabelStyle) {
  return totals.map((month) => {
    const bar = { value: month.totalSen, label: formatMonthShort(month.key) };
    if (month.key !== selectedKey) return { ...bar, frontColor: other };
    return { ...bar, frontColor: selected, labelTextStyle: selectedLabelStyle };
  });
}
