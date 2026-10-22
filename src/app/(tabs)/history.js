import { router } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, SectionList, StyleSheet, Text } from 'react-native';

import { ErrorText } from '../../components/ErrorText';
import { SessionCard } from '../../components/SessionCard';
import { useThemedStyles } from '../../components/ThemeProvider';
import { sessions, useDatabase } from '../../db';
import { useFocusedLoad } from '../../hooks/useFocusedLoad';
import { formatMonth } from '../../lib/time';
import { historyByMonth } from '../../spending/summary';
import { totalLineText } from '../../text/spendingText';

// Each tap is a new request, so Spending moves to the month even when the
// same one was opened before. Only the tap handler reads the clock; the React
// Compiler lint cannot tell it from render code, so the read lives out here.
const tapId = () => String(Date.now());

// History: finished parking sessions, newest first, in months with each
// month's total. A month's header opens that month on Spending.
export default function History() {
  const db = useDatabase();
  const styles = useThemedStyles(createStyles);
  // Every session, not the default 200: each month's total must count all of its sessions.
  const load = useCallback(() => sessions.listHistory(db, { limit: null }), [db]);
  const { data, error } = useFocusedLoad(load);

  if (error) return <ErrorText error={error} />;
  if (!data) return null;

  const months = historyByMonth(data);
  // A car's name only tells the sessions apart when there are several cars.
  const showVehicle = new Set(data.map((row) => row.vehicle_id)).size > 1;
  const openMonth = (key) => router.navigate({ pathname: '/spending', params: { month: key, at: tapId() } });

  return (
    <SectionList
      sections={months}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.container}
      stickySectionHeadersEnabled={false}
      ListEmptyComponent={<Text style={styles.muted}>No finished parking yet.</Text>}
      renderSectionHeader={({ section }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityHint="Opens this month on Spending"
          onPress={() => openMonth(section.key)}
          style={({ pressed }) => [
            styles.header,
            section !== months[0] && styles.laterHeader,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.month}>{formatMonth(section.key)}</Text>
          <Text style={styles.total}>{totalLineText(section)}</Text>
        </Pressable>
      )}
      renderItem={({ item }) => <SessionCard session={item} showVehicle={showVehicle} />}
    />
  );
}

const createStyles = (c) =>
  StyleSheet.create({
    container: { padding: 16, gap: 10 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      minHeight: 44,
      paddingHorizontal: 4,
    },
    // The list's gap plus this keeps months apart, as sections are.
    laterHeader: { marginTop: 12 },
    pressed: { opacity: 0.6 },
    month: { color: c.muted, fontSize: 12, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase' },
    total: { color: c.text, fontSize: 13, fontWeight: '600' },
    muted: { color: c.muted },
  });
