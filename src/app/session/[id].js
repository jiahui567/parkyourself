import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '../../components/Button';
import { ErrorText } from '../../components/ErrorText';
import { colours, space } from '../../components/theme';
import { sessions, useDatabase } from '../../db';
import { useFocusedLoad } from '../../hooks/useFocusedLoad';
import { useNow } from '../../hooks/useNow';
import { formatDate, formatDuration, formatTime } from '../../lib/time';
import { routeBackText } from '../../text/sessionText';
import { swatchFor, textColourOn } from '../../zone/zoneColour';

const goHome = () => (router.canGoBack() ? router.back() : router.replace('/'));

// Find: where the car is and the way back. An active session ends with
// "Found my car"; an ended one (opened from History) can be deleted.
export default function SessionScreen() {
  const db = useDatabase();
  const { id } = useLocalSearchParams();
  const load = useCallback(() => sessions.getDetails(db, id), [db, id]);
  const { data: session, error, loading } = useFocusedLoad(load);
  const now = useNow();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);

  if (error) return <ErrorText error={error} />;
  if (loading) return null;
  if (!session) return <ErrorText error={new Error('This parking session no longer exists.')} />;

  const active = session.status === 'active';
  const swatch = swatchFor(session.zone_colour_name);
  const spotColours = swatch ? { backgroundColor: swatch } : { backgroundColor: colours.card };
  const spotTextStyle = { color: swatch ? textColourOn(swatch) : colours.text };
  const route = routeBackText(session);
  const durationMs = Math.max(0, (active ? now : session.ended_at) - session.started_at);

  const run = async (action) => {
    setBusy(true);
    setActionError(null);
    try {
      await action();
      goHome();
    } catch (e) {
      setActionError(e);
      setBusy(false);
    }
  };

  const confirmDelete = () =>
    Alert.alert('Delete this parking session?', 'Its photos are deleted too.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => run(() => sessions.remove(db, session.id)) },
    ]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: session.vehicle_name }} />

      <View style={[styles.spot, spotColours]}>
        {session.level || session.bay ? (
          <>
            {session.level && <Text style={[styles.level, spotTextStyle]}>{session.level}</Text>}
            {session.bay && <Text style={[styles.bay, spotTextStyle]}>Bay {session.bay}</Text>}
          </>
        ) : (
          <Text style={[styles.bay, spotTextStyle]}>No level or bay recorded</Text>
        )}
        {session.zone_colour_name && <Text style={spotTextStyle}>{session.zone_colour_name} zone</Text>}
      </View>

      {route && (
        <View style={styles.card}>
          <Text style={styles.label}>Way back</Text>
          <Text style={styles.route}>{route}</Text>
        </View>
      )}

      <View style={styles.card}>
        {session.place_name && <Text style={styles.label}>{session.place_name}</Text>}
        <Text>
          {formatDate(session.started_at)}, {formatTime(session.started_at)}
          {!active && ` to ${formatTime(session.ended_at)}`}
        </Text>
        <Text style={styles.muted}>{active ? 'Parked for ' : 'Parked '}{formatDuration(durationMs)}</Text>
        {session.note && <Text>{session.note}</Text>}
      </View>

      <ErrorText error={actionError} />
      {active ? (
        <Button title="Found my car" onPress={() => run(() => sessions.end(db, session.id))} disabled={busy} />
      ) : (
        <Button title="Delete" variant="danger" onPress={confirmDelete} disabled={busy} />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: space },
  spot: { borderRadius: 12, padding: 24, alignItems: 'center', gap: 4 },
  level: { fontSize: 56, fontWeight: '800' },
  bay: { fontSize: 28, fontWeight: '700' },
  card: { backgroundColor: colours.card, borderRadius: 12, padding: 16, gap: 6 },
  label: { fontWeight: '600', color: colours.text },
  route: { fontSize: 17, lineHeight: 24, color: colours.text },
  muted: { color: colours.muted },
});
