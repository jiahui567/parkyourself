import { Stack, router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { Button } from '../../components/Button';
import { ErrorText } from '../../components/ErrorText';
import { Field } from '../../components/Field';
import { colours, space } from '../../components/theme';
import { useDatabase, vehicles } from '../../db';

// Add a car. Home sends you here on first run, when there are no cars yet.
export default function AddCar() {
  const db = useDatabase();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await vehicles.add(db, { name });
      if (router.canGoBack()) router.back();
      else router.replace('/');
    } catch (e) {
      setError(e);
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: 'Add a car' }} />
      <Text style={styles.intro}>Give your car a name you will recognise, such as &quot;My Myvi&quot;.</Text>
      <Field label="Name" value={name} onChangeText={setName} placeholder="My Myvi" autoFocus />
      <ErrorText error={error} />
      <Button title={saving ? 'Saving…' : 'Save'} onPress={save} disabled={saving} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: space },
  intro: { color: colours.muted },
});
