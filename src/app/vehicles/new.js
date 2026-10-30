import { Stack, router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { Button } from '../../components/Button';
import { ErrorText } from '../../components/ErrorText';
import { Field } from '../../components/Field';
import { space } from '../../components/theme';
import { useThemedStyles } from '../../components/ThemeProvider';
import { useDatabase, vehicles } from '../../db';
import { MAX_LENGTH } from '../../lib/textLimits';

// Add a car. Home sends you here on first run, when there are no cars yet.
export default function AddCar() {
  const db = useDatabase();
  const styles = useThemedStyles(createStyles);
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
      <Field
        label="Name"
        value={name}
        onChangeText={setName}
        placeholder="e.g. My Myvi"
        maxLength={MAX_LENGTH.vehicle.name}
        autoFocus
      />
      <ErrorText error={error} />
      <Button title={saving ? 'Saving…' : 'Save'} onPress={save} disabled={saving} />
    </ScrollView>
  );
}

const createStyles = (c) =>
  StyleSheet.create({
    container: { padding: 16, gap: space },
    intro: { color: c.muted },
  });
