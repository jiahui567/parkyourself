import { Stack, router } from 'expo-router';
import { useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ErrorText } from '../../components/ErrorText';
import { ListRow } from '../../components/List';
import { radius, space } from '../../components/theme';
import { useThemedStyles } from '../../components/ThemeProvider';
import { places, useDatabase } from '../../db';
import { useFocusedLoad } from '../../hooks/useFocusedLoad';
import { visitsText } from '../../text/visitsText';

// Places: every saved place with how often you parked there. Places are made
// on Park, so there is no add button; tap one to edit its rates, rename or
// delete it.
export default function Places() {
  const db = useDatabase();
  const styles = useThemedStyles(createStyles);
  const load = useCallback(() => places.listWithVisits(db), [db]);
  const { data: rows, error } = useFocusedLoad(load);

  if (error) return <ErrorText error={error} />;
  if (!rows) return null;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: 'Places' }} />
      {rows.length === 0 ? (
        <Text style={styles.empty}>
          No places yet. A place is added when you type its name on Park, with the rates you enter there.
        </Text>
      ) : (
        // One card with hairlines between rows, like Settings and Cars.
        <View style={styles.card}>
          {rows.map((place, index) => (
            <ListRow
              key={place.id}
              label={place.name}
              value={visitsText(place.visits)}
              onPress={() => router.push(`/places/${place.id}`)}
              first={index === 0}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const createStyles = (c) =>
  StyleSheet.create({
    container: { padding: 16, gap: space },
    card: { backgroundColor: c.card, borderRadius: radius.card, overflow: 'hidden', boxShadow: c.shadow },
    empty: { color: c.muted, lineHeight: 20 },
  });
