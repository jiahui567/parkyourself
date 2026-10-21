import { Stack, router } from 'expo-router';
import { useCallback } from 'react';
import { FlatList, Pressable, StyleSheet, Text } from 'react-native';

import { ErrorText } from '../components/ErrorText';
import { colours } from '../components/theme';
import { sessions, useDatabase } from '../db';
import { useFocusedLoad } from '../hooks/useFocusedLoad';
import { formatDate, formatDuration, formatTime } from '../lib/time';
import { spotText } from '../text/sessionText';

// History: finished parking sessions, newest first.
export default function History() {
  const db = useDatabase();
  const load = useCallback(() => sessions.listHistory(db), [db]);
  const { data, error } = useFocusedLoad(load);

  if (error) return <ErrorText error={error} />;
  if (!data) return null;

  return (
    <>
      <Stack.Screen options={{ title: 'History' }} />
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.container}
        ListEmptyComponent={<Text style={styles.muted}>No finished parking yet.</Text>}
        renderItem={({ item }) => (
          <Pressable accessibilityRole="button" style={styles.row} onPress={() => router.push(`/session/${item.id}`)}>
            <Text style={styles.title}>
              {formatDate(item.started_at)}, {formatTime(item.started_at)}
            </Text>
            <Text>{[item.vehicle_name, item.place_name, spotText(item)].filter(Boolean).join(' · ')}</Text>
            <Text style={styles.muted}>{formatDuration(Math.max(0, item.ended_at - item.started_at))}</Text>
          </Pressable>
        )}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 8 },
  row: { backgroundColor: colours.card, borderRadius: 12, padding: 14, gap: 2 },
  title: { fontWeight: '600', color: colours.text },
  muted: { color: colours.muted },
});
