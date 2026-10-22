import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatDate, formatDuration, formatTime } from '../lib/time';
import { spotText } from '../text/sessionText';
import { amountText } from '../text/spendingText';
import { swatchFor } from '../zone/zoneColour';
import { radius } from './theme';
import { useThemedStyles } from './ThemeProvider';

// One finished parking session as a card (History, and a month's sessions
// from Spending): when, which car, where, how long, and what it cost when a
// fee or amount paid is known. Tapping it opens the session.
export function SessionCard({ session }) {
  const styles = useThemedStyles(createStyles);
  const swatch = swatchFor(session.zone_colour_name);
  const amount = amountText(session);
  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={() => router.push(`/session/${session.id}`)}
    >
      <View style={styles.details}>
        <View style={styles.titleRow}>
          {swatch && <View style={[styles.swatch, { backgroundColor: swatch }]} />}
          <Text style={styles.title}>
            {formatDate(session.started_at)}, {formatTime(session.started_at)}
          </Text>
        </View>
        <Text style={styles.body}>
          {[session.vehicle_name, session.place_name, spotText(session)].filter(Boolean).join(' · ')}
        </Text>
        <Text style={styles.muted}>{formatDuration(Math.max(0, session.ended_at - session.started_at))}</Text>
      </View>
      {amount && <Text style={styles.amount}>{amount}</Text>}
    </Pressable>
  );
}

const createStyles = (c) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      backgroundColor: c.card,
      borderRadius: radius.card,
      padding: 16,
      boxShadow: c.shadow,
    },
    pressed: { opacity: 0.85 },
    details: { flex: 1, gap: 4 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    swatch: { width: 12, height: 12, borderRadius: 6, borderWidth: 1, borderColor: c.border },
    title: { flexShrink: 1, fontWeight: '600', fontSize: 16, color: c.text },
    body: { color: c.text },
    muted: { color: c.muted },
    amount: { fontWeight: '600', fontSize: 16, color: c.text },
  });
