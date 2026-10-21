import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { radius } from '../../components/theme';
import { useThemedStyles } from '../../components/ThemeProvider';

// Made-up bar heights for the preview chart; real totals come with milestone M6.
const PREVIEW_BARS = [0.35, 0.5, 0.3, 0.65, 0.45, 0.8, 0.55, 0.7, 0.4, 0.6, 0.75, 0.9];

// Spending: a preview until milestone M6 adds monthly totals (PLAN.md, "Screens").
export default function Spending() {
  const styles = useThemedStyles(createStyles);
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Monthly spending</Text>
          <Text style={styles.badge}>Coming soon</Text>
        </View>
        <View style={styles.chart} accessible={false}>
          {PREVIEW_BARS.map((height, index) => (
            <View
              key={index}
              style={[styles.bar, { height: `${height * 100}%` }, index === PREVIEW_BARS.length - 1 && styles.barNow]}
            />
          ))}
        </View>
        <Text style={styles.muted}>
          See what you spend on parking each month, with totals by place and by car, and the last 12 months as a chart.
        </Text>
      </View>
    </ScrollView>
  );
}

const createStyles = (c) =>
  StyleSheet.create({
    container: { padding: 16, gap: 12 },
    card: { backgroundColor: c.card, borderRadius: radius.card, padding: 16, gap: 16, boxShadow: c.shadow },
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    title: { fontSize: 18, fontWeight: '600', color: c.text },
    badge: {
      color: c.accent,
      backgroundColor: c.accentSoft,
      fontSize: 12,
      fontWeight: '600',
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: radius.pill,
      overflow: 'hidden',
    },
    chart: { height: 120, flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
    bar: { flex: 1, borderRadius: 4, backgroundColor: c.surface },
    barNow: { backgroundColor: c.accentSoft },
    muted: { color: c.muted, lineHeight: 20 },
  });
