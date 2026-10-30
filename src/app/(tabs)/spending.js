import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { ErrorText } from '../../components/ErrorText';
import { IconButton } from '../../components/IconButton';
import { ChevronLeftIcon, ChevronRightIcon } from '../../components/icons';
import { ListSection } from '../../components/List';
import { CountUpText, enterUp } from '../../components/motion';
import { radius } from '../../components/theme';
import { useAppTheme, useThemedStyles } from '../../components/ThemeProvider';
import { sessions, useDatabase } from '../../db';
import { useFocusedLoad } from '../../hooks/useFocusedLoad';
import { useNow } from '../../hooks/useNow';
import { formatRM } from '../../lib/money';
import { oneParam } from '../../lib/params';
import { addMonths, formatMonth, localMonthKey } from '../../lib/time';
import { chartBars, chartLayout, chartMaxValue } from '../../spending/chart';
import {
  CHART_MONTHS,
  chartRange,
  chartWindowEnd,
  hasNextMonth,
  requestedMonth,
  spendingView,
} from '../../spending/monthView';
import {
  chartRangeText,
  chartSummaryText,
  emptyMonthText,
  monthStatsText,
  placeLabel,
  sessionCountText,
} from '../../text/spendingText';

const SCREEN_PADDING = 16;
const CARD_PADDING = 16;
const CHART_HEIGHT = 140;
const CHART_SECTIONS = 4;
const BARS_GROW_MS = 500;

// Spending (PLAN.md, "Monthly spending"): a month's total, sessions and time
// parked, the last 12 months as bars, and totals by place and by car that
// open that month's sessions.
export default function Spending() {
  const db = useDatabase();
  const styles = useThemedStyles(createStyles);
  const { colours } = useAppTheme();
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  // Refreshed each minute, so Next month unlocks when a new month starts.
  const currentMonth = localMonthKey(useNow(60 * 1000));
  // month is the one shown; end is the chart's last month (see chartWindowEnd).
  const [view, setView] = useState(() => ({ month: currentMonth, end: currentMonth }));
  const { month, end } = view;
  const select = (next) => setView((current) => ({ month: next, end: chartWindowEnd(next, current.end) }));
  // History opens a month here with ?month=YYYY-MM&at=<tap>. Each tap moves
  // to its month once, so the user can still change months afterwards, and
  // tapping the same month in History again comes back to it.
  const link = useLocalSearchParams();
  const linkAt = oneParam(link.at);
  const [openedAt, setOpenedAt] = useState(null);
  if (linkAt != null && linkAt !== openedAt) {
    setOpenedAt(linkAt);
    const opened = requestedMonth(oneParam(link.month), currentMonth);
    if (opened) select(opened);
  }

  // The rows cover every month of the chart, so picking a month in it (a bar,
  // or Previous and Next inside the 12 months) reads nothing again; only
  // moving the chart's months loads. The rows carry the end they were loaded for.
  const load = useCallback(async () => {
    const rows = await sessions.listHistory(db, { ...chartRange(end), limit: null });
    return { end, rows };
  }, [db, end]);
  const { data, error } = useFocusedLoad(load);

  if (error) return <ErrorText error={error} />;
  if (!data) return null;

  const switcher = (
    <View style={styles.switcher}>
      <IconButton icon={ChevronLeftIcon} label="Previous month" onPress={() => select(addMonths(month, -1))} />
      <Text style={styles.monthTitle} accessibilityRole="header">
        {formatMonth(month)}
      </Text>
      <IconButton
        icon={ChevronRightIcon}
        label="Next month"
        onPress={() => select(addMonths(month, 1))}
        disabled={!hasNextMonth(month, currentMonth)}
      />
    </View>
  );
  // While the chart's new months load, the rows held do not cover month:
  // show none of its numbers rather than an empty or an old month.
  if (data.end !== end) return <ScrollView contentContainerStyle={styles.container}>{switcher}</ScrollView>;

  const { summary, totals } = spendingView(data.rows, month, end);
  const plotWidth = width - 2 * SCREEN_PADDING - 2 * CARD_PADDING;
  const layout = chartLayout(plotWidth, CHART_MONTHS);
  // A bar needs at least 3:1 contrast against the card to be seen: muted, not
  // surface, for the other months, and accent, not primary (2.5:1 on the light
  // card), for the selected one.
  const barColours = { selected: colours.accent, other: colours.muted };
  // gifted-charts grows each bar to its height once, when it mounts, and keeps
  // its bars by position: new totals for the same months (a session ended or
  // deleted, a pull) draw a new chart, or the bars would keep their old heights.
  const barsKey = totals.map((m) => m.totalSen).join(',');
  const openSessions = (params) => router.navigate({ pathname: '/sessions', params: { month, ...params } });

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {switcher}

      <View style={styles.card}>
        {summary.sessions === 0 ? (
          <Text style={styles.muted}>{emptyMonthText(month)}</Text>
        ) : (
          <>
            <CountUpText
              value={summary.totalSen}
              format={formatRM}
              style={styles.total}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
            />
            <Text style={styles.muted}>{monthStatsText(summary)}</Text>
          </>
        )}
      </View>

      <ListSection title={chartRangeText(totals)}>
        <View style={styles.chartCard} accessible accessibilityLabel={chartSummaryText(totals)}>
          <View importantForAccessibility="no-hide-descendants">
            <BarChart
              key={barsKey}
              data={chartBars(totals, month, barColours, styles.chartLabelSelected)}
              width={plotWidth}
              height={CHART_HEIGHT}
              maxValue={chartMaxValue(totals)}
              noOfSections={CHART_SECTIONS}
              barWidth={layout.barWidth}
              spacing={layout.spacing}
              initialSpacing={layout.initialSpacing}
              endSpacing={0}
              barBorderTopLeftRadius={4}
              barBorderTopRightRadius={4}
              hideYAxisText
              yAxisLabelWidth={0}
              yAxisThickness={0}
              yAxisColor={colours.border}
              xAxisThickness={1}
              xAxisColor={colours.border}
              rulesType="solid"
              rulesThickness={1}
              rulesColor={colours.border}
              xAxisLabelTextStyle={styles.chartLabel}
              isAnimated={!reduceMotion}
              animationDuration={BARS_GROW_MS}
              disablePress
              disableScroll
              showScrollIndicator={false}
            />
            {/* One tap target per month over the bars: a bar of a cheap or
                empty month is too small to hit on its own. */}
            <View style={styles.columns}>
              {totals.map((m) => (
                <Pressable key={m.key} style={styles.column} onPress={() => select(m.key)} />
              ))}
            </View>
          </View>
        </View>
      </ListSection>

      {summary.sessions > 0 && (
        <>
          <ListSection title="By place">
            {summary.byPlace.map((group, index) => (
              <TotalRow
                key={group.id ?? 'none'}
                first={index === 0}
                index={index}
                name={placeLabel(group)}
                group={group}
                onPress={() => openSessions({ placeId: group.id ?? 'none' })}
                styles={styles}
              />
            ))}
          </ListSection>
          <ListSection title="By car">
            {summary.byVehicle.map((group, index) => (
              <TotalRow
                key={group.id}
                first={index === 0}
                index={index}
                name={group.name}
                group={group}
                onPress={() => openSessions({ vehicleId: group.id })}
                styles={styles}
              />
            ))}
          </ListSection>
        </>
      )}
    </ScrollView>
  );
}

// A place or car with its total and sessions, in the list-row look of
// ListRow; it opens that month's sessions. Rows fade up one after another.
function TotalRow({ name, group, onPress, first, index, styles }) {
  const { colours } = useAppTheme();
  return (
    <Animated.View entering={enterUp(index)}>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.row, !first && styles.rowDivider, pressed && styles.rowPressed]}
      >
        <View style={styles.rowNames}>
          <Text style={styles.rowLabel} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.rowHint}>{sessionCountText(group.sessions)}</Text>
        </View>
        <Text style={styles.rowTotal}>{formatRM(group.totalSen)}</Text>
        <ChevronRightIcon size={18} color={colours.muted} />
      </Pressable>
    </Animated.View>
  );
}

const createStyles = (c) =>
  StyleSheet.create({
    container: { padding: SCREEN_PADDING, gap: 20 },
    switcher: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    monthTitle: { fontSize: 17, fontWeight: '600', color: c.text },
    card: { backgroundColor: c.card, borderRadius: radius.card, padding: CARD_PADDING, gap: 4, boxShadow: c.shadow },
    total: { fontSize: 40, fontWeight: '800', letterSpacing: -0.6, color: c.text },
    muted: { color: c.muted },
    chartCard: { padding: CARD_PADDING },
    chartLabel: { color: c.muted, fontSize: 11 },
    chartLabelSelected: { color: c.accent, fontSize: 11, fontWeight: '700' },
    columns: { ...StyleSheet.absoluteFillObject, flexDirection: 'row' },
    column: { flex: 1 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 16, minHeight: 48 },
    rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    rowPressed: { backgroundColor: c.surface },
    rowNames: { flex: 1, gap: 2 },
    rowLabel: { fontSize: 16, color: c.text },
    rowHint: { fontSize: 13, color: c.muted },
    rowTotal: { fontSize: 16, fontWeight: '600', color: c.text },
  });
