import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '../components/Button';
import { ChipGroup } from '../components/ChipGroup';
import { ErrorText } from '../components/ErrorText';
import { Field } from '../components/Field';
import { space } from '../components/theme';
import { useThemedStyles } from '../components/ThemeProvider';
import { sessions, useDatabase, vehicles } from '../db';
import { useFocusedLoad } from '../hooks/useFocusedLoad';
import { ZONE_COLOURS } from '../zone/zoneColour';

const ZONE_OPTIONS = ZONE_COLOURS.map((c) => ({ value: c.name, label: c.name, swatch: c.swatch }));
const ACCESS_OPTIONS = [
  { value: 'lift', label: 'Lift' },
  { value: 'escalator', label: 'Escalator' },
  { value: 'stairs', label: 'Stairs' },
  { value: 'other', label: 'Other' },
];

const EMPTY_FORM = { level: '', bay: '', zone_colour_name: null, access_type: null, landmark: '', note: '' };

// Park: record where a car is. Opened with ?vehicleId=<id>.
export default function Park() {
  const db = useDatabase();
  const styles = useThemedStyles(createStyles);
  const { vehicleId } = useLocalSearchParams();
  const loadCar = useCallback(() => vehicles.get(db, vehicleId), [db, vehicleId]);
  const { data: car, error: loadError, loading } = useFocusedLoad(loadCar);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const setField = (field) => (value) => setForm((current) => ({ ...current, [field]: value }));

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const id = await sessions.start(db, { vehicle_id: vehicleId, ...form });
      router.replace(`/session/${id}`);
    } catch (e) {
      setSaveError(e);
      setSaving(false);
    }
  };

  if (loadError) return <ErrorText error={loadError} />;
  if (loading) return null;
  if (!car) return <ErrorText error={new Error('This car no longer exists.')} />;

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: `Park ${car.name}` }} />
      <View style={styles.row}>
        <View style={styles.half}>
          <Field label="Level" value={form.level} onChangeText={setField('level')} placeholder="B2" autoCapitalize="characters" />
        </View>
        <View style={styles.half}>
          <Field label="Bay" value={form.bay} onChangeText={setField('bay')} placeholder="C14" autoCapitalize="characters" />
        </View>
      </View>

      <Text style={styles.label}>Zone colour</Text>
      <ChipGroup options={ZONE_OPTIONS} value={form.zone_colour_name} onChange={setField('zone_colour_name')} />

      <Text style={styles.label}>How you left the car park</Text>
      <ChipGroup options={ACCESS_OPTIONS} value={form.access_type} onChange={setField('access_type')} />

      <Field
        label="First shop you saw"
        value={form.landmark}
        onChangeText={setField('landmark')}
        placeholder="Starbucks"
      />
      <Field label="Note" value={form.note} onChangeText={setField('note')} multiline />

      <ErrorText error={saveError} />
      <Button title={saving ? 'Saving…' : 'Save'} onPress={save} disabled={saving} />
    </ScrollView>
  );
}

const createStyles = (c) =>
  StyleSheet.create({
    container: { padding: 16, gap: space },
    row: { flexDirection: 'row', gap: space },
    half: { flex: 1 },
    label: { fontWeight: '600', color: c.text },
  });
