import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatDate, formatDuration, formatTime } from '../lib/time';
import { spotText } from '../text/sessionText';
import { amountText } from '../text/spendingText';
import { swatchFor } from '../zone/zoneColour';
import { radius } from './theme';
import { useThemedStyles } from './ThemeProvider';

// One finished parking session as a card (History, and a month's sessions
// from Spending): the place first, as that is what a list is scanned for,
// then when and how long, the spot, and what it cost when a fee or amount
// paid is known. showVehicle adds the car's name, which only helps with
// several cars. Tapping it opens the session.
export function SessionCard({ session, showVehicle = true }) {
  const styles = useThemedStyles(createStyles);
  const swatch = swatchFor(session.zone_colour_name);
  const amount = amountText(session);
  const detail = [spotText(session), showVehicle && session.vehicle_name].filter(Boolean).join(' · ');
  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={() => router.navigate(`/session/${session.id}`)}
    >
      <View style={styles.details}>
        <Text style={session.place_name ? styles.title : styles.titleMuted} numberOfLines={2}>
          {session.place_name ?? 'No place'}
        </Text>
        <Text style={styles.muted}>
          {formatDate(session.started_at)}, {formatTime(session.started_at)} ·{' '}
          {formatDuration(Math.max(0, session.ended_at - session.started_at))}
        </Text>
        {detail ? (
          <View style={styles.detailRow}>
            {swatch && <View style={[styles.swatch, { backgroundColor: swatch }]} />}
            <Text style={styles.body}>{detail}</Text>
          </View>
        ) : null}
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
    title: { fontWeight: '600', fontSize: 16, color: c.text },
    titleMuted: { fontWeight: '600', fontSize: 16, color: c.muted },
    detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    swatch: { width: 12, height: 12, borderRadius: 6, borderWidth: 1, borderColor: c.border },
    body: { flexShrink: 1, color: c.text },
    muted: { color: c.muted },
    amount: { fontWeight: '600', fontSize: 16, color: c.text },
  });
