import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { ErrorText } from '../components/ErrorText';
import { enterUp } from '../components/motion';
import { SessionCard } from '../components/SessionCard';
import { useThemedStyles } from '../components/ThemeProvider';
import { places, sessions, useDatabase, vehicles } from '../db';
import { useFocusedLoad } from '../hooks/useFocusedLoad';
import { formatMonth } from '../lib/time';
import { ownerName, sessionsFilter } from '../spending/sessionsFilter';
import { monthSummary } from '../spending/summary';
import { noSessionsText, totalLineText } from '../text/spendingText';

// One month's sessions at a place or in a car, opened from Spending with
// ?month=YYYY-MM and placeId=<id> ('none' for no place) or vehicleId=<id>.
export default function Sessions() {
  const db = useDatabase();
  const styles = useThemedStyles(createStyles);
  const { month, placeId, vehicleId } = useLocalSearchParams();
  const { filter, error: paramsError } = useMemo(
    () => sessionsFilter({ month, placeId, vehicleId }),
    [month, placeId, vehicleId]
  );

  const load = useCallback(async () => {
    if (!filter) return null;
    // The place or car row names an empty list; a deleted place has none,
    // but then its sessions still carry the name.
    const findOwner =
      filter.kind === 'vehicle' ? vehicles.get(db, filter.id) : filter.id ? places.get(db, filter.id) : null;
    // No limit: the header total must count every session in the month.
    const [rows, owner] = await Promise.all([sessions.listHistory(db, { ...filter.query, limit: null }), findOwner]);
    return { rows, owner };
  }, [db, filter]);
  const { data, error } = useFocusedLoad(load);

  const title = <Stack.Screen options={{ title: filter ? formatMonth(filter.month) : 'Sessions' }} />;

  if (paramsError || error) {
    return (
      <View style={styles.container}>
        {title}
        <ErrorText error={paramsError ?? error} />
      </View>
    );
  }
  if (!data) return title;

  const name = ownerName(filter, data.rows, data.owner);
  const summary = monthSummary(data.rows);
  // As on History: a car's name only tells the sessions apart with several cars.
  const showVehicle = summary.byVehicle.length > 1;

  return (
    <>
      {title}
      <FlatList
        data={data.rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.container}
        ListHeaderComponent={
          <View style={styles.header}>
            {name ? <Text style={styles.name}>{name}</Text> : null}
            {summary.sessions > 0 && <Text style={styles.muted}>{totalLineText(summary)}</Text>}
          </View>
        }
        ListEmptyComponent={<Text style={styles.muted}>{noSessionsText(filter.month)}</Text>}
        renderItem={({ item, index }) => (
          <Animated.View entering={enterUp(index)}>
            <SessionCard session={item} showVehicle={showVehicle} />
          </Animated.View>
        )}
      />
    </>
  );
}

const createStyles = (c) =>
  StyleSheet.create({
    container: { padding: 16, gap: 10 },
    header: { gap: 2, paddingHorizontal: 4, paddingBottom: 6 },
    name: { fontSize: 18, fontWeight: '600', color: c.text },
    muted: { color: c.muted },
  });
