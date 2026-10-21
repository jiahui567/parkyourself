import { Link, Redirect, router } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '../components/Button';
import { ErrorText } from '../components/ErrorText';
import { colours, space } from '../components/theme';
import { sessions, useDatabase, vehicles } from '../db';
import { useFocusedLoad } from '../hooks/useFocusedLoad';
import { useNow } from '../hooks/useNow';
import { formatDuration, formatTime } from '../lib/time';
import { spotText } from '../text/sessionText';
import { swatchFor } from '../zone/zoneColour';

// Home: one card per car, showing where it is parked or a Park button.
export default function Home() {
  const db = useDatabase();
  const load = useCallback(async () => {
    const [cars, active] = await Promise.all([vehicles.list(db), sessions.listActive(db)]);
    return { cars, active };
  }, [db]);
  const { data, error } = useFocusedLoad(load);
  const now = useNow();

  if (error) return <ErrorText error={error} />;
  if (!data) return null;
  if (data.cars.length === 0) return <Redirect href="/vehicles/new" />;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {data.cars.map((car) => {
        const session = data.active.find((s) => s.vehicle_id === car.id);
        if (!session) {
          return (
            <View key={car.id} style={styles.card}>
              <Text style={styles.carName}>{car.name}</Text>
              <Button title="Park" onPress={() => router.push({ pathname: '/park', params: { vehicleId: car.id } })} />
            </View>
          );
        }
        const swatch = swatchFor(session.zone_colour_name);
        return (
          <Pressable
            key={car.id}
            accessibilityRole="button"
            style={styles.card}
            onPress={() => router.push(`/session/${session.id}`)}
          >
            <Text style={styles.carName}>{car.name}</Text>
            <View style={styles.spotRow}>
              {swatch && <View style={[styles.swatch, { backgroundColor: swatch }]} />}
              <Text style={styles.spot}>{spotText(session) || 'Parked'}</Text>
            </View>
            <Text style={styles.muted}>
              Since {formatTime(session.started_at)} · {formatDuration(Math.max(0, now - session.started_at))}
            </Text>
          </Pressable>
        );
      })}

      <View style={styles.links}>
        <Link href="/history" style={styles.link}>
          History
        </Link>
        <Link href="/vehicles" style={styles.link}>
          Cars
        </Link>
        {__DEV__ && (
          <Link href="/debug" style={styles.link}>
            Database check
          </Link>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: space },
  card: { backgroundColor: colours.card, borderRadius: 12, padding: 16, gap: 8 },
  carName: { fontSize: 18, fontWeight: '600', color: colours.text },
  spotRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  swatch: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: colours.border },
  spot: { fontSize: 24, fontWeight: '700', color: colours.text },
  muted: { color: colours.muted },
  links: { flexDirection: 'row', gap: 24, justifyContent: 'center', marginTop: 8 },
  link: { color: colours.primary, fontSize: 16, paddingVertical: 8 },
});
