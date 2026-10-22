import { useCallback } from 'react';
import { FlatList, StyleSheet, Text } from 'react-native';

import { ErrorText } from '../../components/ErrorText';
import { SessionCard } from '../../components/SessionCard';
import { useThemedStyles } from '../../components/ThemeProvider';
import { sessions, useDatabase } from '../../db';
import { useFocusedLoad } from '../../hooks/useFocusedLoad';

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
      renderItem={({ item }) => <SessionCard session={item} />}
    />
  );
}

const createStyles = (c) =>
  StyleSheet.create({
    container: { padding: 16, gap: 10 },
    muted: { color: c.muted },
  });
