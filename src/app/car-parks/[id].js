import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ErrorText } from '../../components/ErrorText';
import { radius, space } from '../../components/theme';
import { useThemedStyles } from '../../components/ThemeProvider';
import { carParks, useDatabase } from '../../db';
import { useFocusedLoad } from '../../hooks/useFocusedLoad';
import { localDateKey } from '../../lib/time';
import { carParkCheckedText, carParkRateRows } from '../../text/carParkText';
import { pendingReportsText } from '../../text/reportText';

// A listed car park's rates in effect today, view only (2026-10-26): opened
// from the car park list on Places as /car-parks/<id>, to look up what a car
// park charges. Nothing here can be edited; picking the car park on Park makes
// it your place with these rates.
export default function CarParkScreen() {
  const db = useDatabase();
  const styles = useThemedStyles(createStyles);
  const { id } = useLocalSearchParams();
  const load = useCallback(() => carParks.get(db, id, localDateKey(Date.now())), [db, id]);
  const { data: carPark, error, loading } = useFocusedLoad(load);

  if (error) return <ErrorText error={error} />;
  if (loading) return null;
  if (!carPark) {
    return (
      <>
        <Stack.Screen options={{ title: 'Car park' }} />
        <ErrorText error={new Error('This car park is no longer on the list.')} />
      </>
    );
  }

  // Other users' reports wait for review (C10): the rate may be out of date.
  const pending = pendingReportsText(carPark.reports);
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: carPark.name }} />
      {carPark.area ? <Text style={styles.area}>{carPark.area}</Text> : null}
      <View style={styles.card}>
        {carParkRateRows(carPark.rates).map((row, index) => (
          <View key={row.dayType} style={[styles.row, index > 0 && styles.divider]}>
            <Text style={styles.label}>{row.label}</Text>
            <Text style={styles.value}>{row.value}</Text>
          </View>
        ))}
      </View>
      {carPark.notes ? <Text style={styles.hint}>{carPark.notes}</Text> : null}
      {pending ? <Text style={styles.hint}>{pending}</Text> : null}
      <Text style={styles.hint}>{carParkCheckedText(carPark)}</Text>
    </ScrollView>
  );
}

const createStyles = (c) =>
  StyleSheet.create({
    container: { padding: 16, gap: space },
    area: { fontSize: 15, color: c.muted },
    card: { backgroundColor: c.card, borderRadius: radius.card, overflow: 'hidden', boxShadow: c.shadow },
    row: { paddingVertical: 14, paddingHorizontal: 16, gap: 4 },
    divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    label: { fontWeight: '600', color: c.text },
    value: { fontSize: 15, lineHeight: 22, color: c.text },
    hint: { fontSize: 13, lineHeight: 18, color: c.muted },
  });
