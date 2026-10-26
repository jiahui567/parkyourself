import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '../../components/Button';
import { useDialog } from '../../components/Dialog';
import { ErrorText } from '../../components/ErrorText';
import { Field } from '../../components/Field';
import { IconButton } from '../../components/IconButton';
import { FlagIcon, TrashIcon } from '../../components/icons';
import { RateForm } from '../../components/RateForm';
import { radius, space } from '../../components/theme';
import { useThemedStyles } from '../../components/ThemeProvider';
import { places, useDatabase } from '../../db';
import { changedPlaceRates, placeRatesFormFrom, ratesFromPlaceRatesForm } from '../../fees';
import { useFocusedLoad } from '../../hooks/useFocusedLoad';
import { dayTypeLabel } from '../../text/rateText';

const goBack = () => (router.canGoBack() ? router.back() : router.replace('/places'));

// A place: rename it, edit its weekday and weekend rates and public holiday
// amount, report its rates to the car park list, or delete it. Opened from
// Places as /places/<id>.
export default function PlaceScreen() {
  const db = useDatabase();
  const { id } = useLocalSearchParams();
  const load = useCallback(async () => {
    const place = await places.get(db, id);
    if (!place) return null;
    return { place, rates: await places.getRates(db, id) };
  }, [db, id]);
  const { data, error, loading } = useFocusedLoad(load);

  if (error) return <ErrorText error={error} />;
  if (loading) return null;
  if (!data) {
    return (
      <>
        <Stack.Screen options={{ title: 'Place' }} />
        <ErrorText error={new Error('This place no longer exists.')} />
      </>
    );
  }
  // The form keeps what was typed when the screen reloads on focus.
  return <PlaceForm db={db} place={data.place} rates={data.rates} />;
}

function PlaceForm({ db, place, rates }) {
  const styles = useThemedStyles(createStyles);
  const headerHeight = useHeaderHeight();
  const showDialog = useDialog();
  const [name, setName] = useState(place.name);
  const [form, setForm] = useState(() => placeRatesFormFrom(rates));
  // 'save' or 'delete' while one runs; both lock the whole form.
  const [busy, setBusy] = useState(null);
  const [saveError, setSaveError] = useState(null);

  const setRate = (dayType) => (next) => setForm((current) => ({ ...current, [dayType]: next }));

  const run = async (kind, action) => {
    setBusy(kind);
    setSaveError(null);
    try {
      await action();
      goBack();
    } catch (e) {
      setSaveError(e);
      setBusy(null);
    }
  };

  const save = () => {
    const { rates: changes, error } = ratesFromPlaceRatesForm(form);
    if (error) {
      setSaveError(new Error(error));
      return;
    }
    run('save', () => places.saveDetails(db, place.id, { name, rates: changedPlaceRates(rates, changes) }));
  };

  // A failure shows in a dialog: Delete is in the header, far above the
  // error line under the form.
  const remove = async () => {
    setBusy('delete');
    try {
      await places.remove(db, place.id);
      goBack();
    } catch (e) {
      setBusy(null);
      showDialog({ title: `Could not delete ${place.name}`, message: String(e?.message ?? e) });
    }
  };

  const confirmDelete = () =>
    showDialog({
      title: `Delete ${place.name}?`,
      message: 'Its saved rates are deleted too. Past parking keeps the name.',
      buttons: [
        { text: 'Delete', style: 'destructive', onPress: remove },
        { text: 'Cancel', style: 'cancel' },
      ],
    });

  return (
    // As on Park: Android draws edge to edge, so the window no longer shrinks
    // for the keyboard; the padding keeps the holiday amount and Save reachable.
    <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={headerHeight} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Actions on the whole place sit in the header's corner, away from
            Save. Report sends the saved rates, so Save first after an edit. */}
        <Stack.Screen
          options={{
            title: place.name,
            headerRight: () => (
              <View style={styles.headerActions}>
                <IconButton
                  icon={FlagIcon}
                  label="Report rates to the car park list"
                  onPress={() => router.push(`/report/${place.id}`)}
                  disabled={Boolean(busy)}
                />
                <IconButton
                  icon={TrashIcon}
                  label={`Delete ${place.name}`}
                  tone="danger"
                  onPress={confirmDelete}
                  disabled={Boolean(busy)}
                />
              </View>
            ),
          }}
        />
        <Field label="Name" value={name} onChangeText={setName} editable={!busy} />

        {['weekday', 'weekend'].map((dayType) => (
          <View key={dayType} style={styles.card}>
            <Text style={styles.cardTitle}>{dayTypeLabel(dayType)} rate</Text>
            <RateForm value={form[dayType]} onChange={setRate(dayType)} disabled={Boolean(busy)} />
          </View>
        ))}

        <View style={styles.card}>
          <Field
            label="Public holiday amount (RM, per entry)"
            value={form.holidayAmount}
            onChangeText={(text) => setForm((current) => ({ ...current, holidayAmount: text }))}
            placeholder="Optional"
            keyboardType="decimal-pad"
            editable={!busy}
          />
          <Text style={styles.hint}>Leave empty to use the weekend rate</Text>
        </View>

        <ErrorText error={saveError} />
        <Button title={busy === 'save' ? 'Saving…' : 'Save'} onPress={save} disabled={Boolean(busy)} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (c) =>
  StyleSheet.create({
    screen: { flex: 1 },
    container: { padding: 16, gap: space },
    card: { backgroundColor: c.card, borderRadius: radius.card, padding: 16, gap: space, boxShadow: c.shadow },
    cardTitle: { fontSize: 17, fontWeight: '600', color: c.text },
    hint: { fontSize: 13, color: c.muted, marginTop: -4 },
    // Apart enough that the two icons' touch areas do not overlap.
    headerActions: { flexDirection: 'row', gap: 12 },
  });
