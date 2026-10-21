import { router } from 'expo-router';
import { useCallback } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { ErrorText } from '../../components/ErrorText';
import { radius } from '../../components/theme';
import { useThemedStyles } from '../../components/ThemeProvider';
import { sessions, useDatabase } from '../../db';
import { useFocusedLoad } from '../../hooks/useFocusedLoad';
import { formatDate, formatDuration, formatTime } from '../../lib/time';
import { spotText } from '../../text/sessionText';
import { swatchFor } from '../../zone/zoneColour';

// History: finished parking sessions, newest first.
export default function History() {
  const db = useDatabase();
  const styles = useThemedStyles(createStyles);
  const load = useCallback(() => sessions.listHistory(db), [db]);
  const { data, error } = useFocusedLoad(load);

  if (error) return <ErrorText error={error} />;
  if (!data) return null;

  return (
    <FlatList
      data={data}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.container}
      ListEmptyComponent={<Text style={styles.muted}>No finished parking yet.</Text>}
      renderItem={({ item }) => {
        const swatch = swatchFor(item.zone_colour_name);
        return (
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            onPress={() => router.push(`/session/${item.id}`)}
          >
            <View style={styles.titleRow}>
              {swatch && <View style={[styles.swatch, { backgroundColor: swatch }]} />}
              <Text style={styles.title}>
                {formatDate(item.started_at)}, {formatTime(item.started_at)}
              </Text>
            </View>
            <Text style={styles.body}>
              {[item.vehicle_name, item.place_name, spotText(item)].filter(Boolean).join(' · ')}
            </Text>
            <Text style={styles.muted}>{formatDuration(Math.max(0, item.ended_at - item.started_at))}</Text>
          </Pressable>
        );
      }}
    />
  );
}

const createStyles = (c) =>
  StyleSheet.create({
    container: { padding: 16, gap: 10 },
    row: { backgroundColor: c.card, borderRadius: radius.card, padding: 16, gap: 4, boxShadow: c.shadow },
    pressed: { opacity: 0.85 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    swatch: { width: 12, height: 12, borderRadius: 6, borderWidth: 1, borderColor: c.border },
    title: { fontWeight: '600', fontSize: 16, color: c.text },
    body: { color: c.text },
    muted: { color: c.muted },
  });
