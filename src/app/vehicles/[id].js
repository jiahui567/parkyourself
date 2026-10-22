import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { Button } from '../../components/Button';
import { ErrorText } from '../../components/ErrorText';
import { Field } from '../../components/Field';
import { space } from '../../components/theme';
import { useDatabase, vehicles } from '../../db';
import { useFocusedLoad } from '../../hooks/useFocusedLoad';
import { syncNotifications } from '../../notify/notifications';

// Rename a car, opened from Cars. Its past and current parking show the new name.
export default function RenameCar() {
  const db = useDatabase();
  const { id } = useLocalSearchParams();
  const load = useCallback(() => vehicles.get(db, id), [db, id]);
  const { data: car, error, loading } = useFocusedLoad(load);
  // null until the user types, so the field starts with the saved name.
  const [name, setName] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  if (error) return <ErrorText error={error} />;
  if (loading) return null;
  if (!car) return <ErrorText error={new Error('This car no longer exists.')} />;

  const typed = name ?? car.name;

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await vehicles.rename(db, car.id, typed);
      // A parked car's notification and reminders carry its name.
      await syncNotifications(db);
      if (router.canGoBack()) router.back();
      else router.replace('/vehicles');
    } catch (e) {
      setSaveError(e);
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: 'Rename car' }} />
      <Field label="Name" value={typed} onChangeText={setName} placeholder="e.g. My Myvi" autoFocus />
      <ErrorText error={saveError} />
      <Button title={saving ? 'Saving…' : 'Save'} onPress={save} disabled={saving} />
    </ScrollView>
  );
}

// No colours here, so the styles need not follow the theme.
const styles = StyleSheet.create({
  container: { padding: 16, gap: space },
});
