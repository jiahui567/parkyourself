import { Stack, router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '../../components/Button';
import { ErrorText } from '../../components/ErrorText';
import { colours, space } from '../../components/theme';
import { useDatabase, vehicles } from '../../db';
import { useFocusedLoad } from '../../hooks/useFocusedLoad';

// Cars: add a car, choose the default, archive a car you no longer use.
export default function Cars() {
  const db = useDatabase();
  const load = useCallback(() => vehicles.list(db), [db]);
  const { data: cars, error, reload } = useFocusedLoad(load);
  const [actionError, setActionError] = useState(null);

  const run = async (action) => {
    setActionError(null);
    try {
      await action();
      reload();
    } catch (e) {
      setActionError(e);
    }
  };

  const confirmArchive = (car) =>
    Alert.alert(`Archive ${car.name}?`, 'It disappears from Home, but its history is kept.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Archive', style: 'destructive', onPress: () => run(() => vehicles.archive(db, car.id)) },
    ]);

  if (error) return <ErrorText error={error} />;
  if (!cars) return null;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: 'Cars' }} />
      <ErrorText error={actionError} />
      {cars.map((car) => (
        <View key={car.id} style={styles.card}>
          <Text style={styles.name}>
            {car.name}
            {car.is_default ? '  (default)' : ''}
          </Text>
          <View style={styles.actions}>
            {!car.is_default && (
              <View style={styles.action}>
                <Button title="Make default" variant="secondary" onPress={() => run(() => vehicles.setDefault(db, car.id))} />
              </View>
            )}
            <View style={styles.action}>
              <Button title="Archive" variant="danger" onPress={() => confirmArchive(car)} />
            </View>
          </View>
        </View>
      ))}
      <Button title="Add a car" onPress={() => router.push('/vehicles/new')} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: space },
  card: { backgroundColor: colours.card, borderRadius: 12, padding: 16, gap: 10 },
  name: { fontSize: 17, fontWeight: '600', color: colours.text },
  actions: { flexDirection: 'row', gap: space },
  action: { flex: 1 },
});
