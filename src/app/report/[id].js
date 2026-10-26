import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { reportRatesFrom } from '../../carparks/reports';
import { sendReport, signedInEmail } from '../../cloud/supabase';
import { Button } from '../../components/Button';
import { CameraCapture } from '../../components/CameraCapture';
import { useDialog } from '../../components/Dialog';
import { Disclosure } from '../../components/Disclosure';
import { ErrorText } from '../../components/ErrorText';
import { Field } from '../../components/Field';
import { CameraIcon } from '../../components/icons';
import { RateForm } from '../../components/RateForm';
import { radius, space } from '../../components/theme';
import { useThemedStyles } from '../../components/ThemeProvider';
import { carParks, deletePhotoFiles, places, preparePhoto, useDatabase } from '../../db';
import { placeRatesFormFrom, ratesFromPlaceRatesForm } from '../../fees';
import { useFocusedLoad } from '../../hooks/useFocusedLoad';
import { localDateKey } from '../../lib/time';
import { dayTypeLabel } from '../../text/rateText';
import {
  listedRatesText,
  pendingReportsText,
  reportRateRowHint,
  reportScreenText,
  reportSentText,
} from '../../text/reportText';

const goBack = () => (router.canGoBack() ? router.back() : router.replace('/places'));

// Report a saved place's rates to the car park list (C10): a rate change when
// a listed car park has its name, else a suggestion to add it. Opened from a
// place as /report/<place id>. The rates start as the place's saved ones, so
// most reports only need a photo of the rate board and Send.
export default function ReportScreen() {
  const db = useDatabase();
  const { id } = useLocalSearchParams();
  const load = useCallback(async () => {
    const place = await places.get(db, id);
    if (!place) return null;
    const [rates, listed] = await Promise.all([
      places.getRates(db, id),
      carParks.findByName(db, place.name, localDateKey(Date.now())),
    ]);
    // Reloaded on focus, so coming back signed in shows Send. A session that
    // could not be checked (expired, offline) shows Sign in and the reason.
    try {
      return { place, rates, listed, email: await signedInEmail(), accountError: null };
    } catch (e) {
      return { place, rates, listed, email: null, accountError: e };
    }
  }, [db, id]);
  const { data, error, loading } = useFocusedLoad(load);

  if (error) return <ErrorText error={error} />;
  if (loading) return null;
  if (!data) {
    return (
      <>
        <Stack.Screen options={{ title: 'Report rates' }} />
        <ErrorText error={new Error('This place no longer exists.')} />
      </>
    );
  }
  // The form keeps what was typed when the screen reloads on focus.
  return <ReportForm {...data} />;
}

function ReportForm({ place, rates, listed, email, accountError }) {
  const styles = useThemedStyles(createStyles);
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const showDialog = useDialog();
  const text = reportScreenText({ name: place.name, isListed: Boolean(listed), hasLocation: place.lat != null });
  const pending = listed && pendingReportsText(listed.reports);

  const [form, setForm] = useState(() => placeRatesFormFrom(rates));
  const [note, setNote] = useState('');
  const [open, setOpen] = useState({ weekday: false, weekend: false, holiday: false, note: false });
  const toggle = (part) => () => setOpen((current) => ({ ...current, [part]: !current[part] }));
  const setRate = (dayType) => (next) => setForm((current) => ({ ...current, [dayType]: next }));

  // The rate board photo: a prepared JPEG in the cache, deleted when it is
  // replaced or removed, when the report is sent, or when the screen closes.
  const [photoUri, setPhotoUri] = useState(null);
  const photoRef = useRef(null);
  useEffect(() => {
    photoRef.current = photoUri;
  }, [photoUri]);
  // A photo still being prepared when the screen closes is deleted once ready.
  const closed = useRef(false);
  useEffect(() => {
    // Set again on every run: Fast Refresh runs the cleanup, then this again.
    closed.current = false;
    return () => {
      closed.current = true;
      deletePhotoFiles(photoRef.current ? [photoRef.current] : []);
    };
  }, []);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [photoError, setPhotoError] = useState(null);

  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const busy = sending || preparing;

  const addPhoto = async (picture) => {
    setCameraOpen(false);
    setPreparing(true);
    setPhotoError(null);
    try {
      const uri = await preparePhoto(picture);
      if (closed.current) {
        deletePhotoFiles([uri]);
        return;
      }
      const old = photoRef.current;
      setPhotoUri(uri);
      if (old) deletePhotoFiles([old]);
    } catch (e) {
      setPhotoError(e);
    } finally {
      setPreparing(false);
    }
  };
  const removePhoto = () => {
    deletePhotoFiles([photoUri]);
    setPhotoUri(null);
  };

  const send = async () => {
    const typed = ratesFromPlaceRatesForm(form);
    const checked = typed.error ? typed : reportRatesFrom(typed.rates);
    if (checked.error) {
      setSendError(new Error(checked.error));
      return;
    }
    setSending(true);
    setSendError(null);
    let sent;
    try {
      sent = await sendReport({
        carParkId: listed?.id ?? null,
        name: place.name,
        lat: place.lat,
        lng: place.lng,
        rates: checked.rates,
        note: note.trim(),
        photoUri,
      });
    } catch (e) {
      setSendError(e);
      setSending(false);
      return;
    }
    if (photoUri) removePhoto();
    // The dialog belongs to the root layout, so it stays up on the place.
    showDialog(reportSentText(sent.photoError));
    goBack();
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: text.title }} />
      <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={headerHeight} style={styles.screen}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.intro}>{text.intro}</Text>
          {listed && <Text style={styles.hint}>{listedRatesText(listed.rates)}</Text>}
          {pending && <Text style={styles.hint}>{pending}</Text>}

          <View style={styles.foldCard}>
            {['weekday', 'weekend'].map((dayType, index) => (
              <Disclosure
                key={dayType}
                label={`${dayTypeLabel(dayType)} rate`}
                hint={reportRateRowHint(dayType, form[dayType])}
                open={open[dayType]}
                onToggle={toggle(dayType)}
                first={index === 0}
              >
                <RateForm value={form[dayType]} onChange={setRate(dayType)} disabled={busy} />
              </Disclosure>
            ))}
            <Disclosure
              label="Public holiday amount"
              hint={reportRateRowHint('holiday', form.holidayAmount)}
              open={open.holiday}
              onToggle={toggle('holiday')}
              first={false}
            >
              <Field
                accessibilityLabel="Public holiday amount (RM, per entry)"
                value={form.holidayAmount}
                onChangeText={(next) => setForm((current) => ({ ...current, holidayAmount: next }))}
                placeholder="Optional"
                keyboardType="decimal-pad"
                editable={!busy}
              />
            </Disclosure>
            <Disclosure
              label="Note"
              hint={note.trim() || 'Not set · optional'}
              open={open.note}
              onToggle={toggle('note')}
              first={false}
            >
              <Field
                accessibilityLabel="Note"
                value={note}
                onChangeText={setNote}
                placeholder="e.g. Free for the first 15 minutes"
                multiline
                maxLength={500}
                editable={!busy}
              />
            </Disclosure>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Photo of the rate board</Text>
            <Text style={styles.hint}>Optional. It helps the developer check the rates.</Text>
            {photoUri && <Image source={{ uri: photoUri }} style={styles.photo} accessibilityLabel="Rate board photo" />}
            <View style={styles.row}>
              <Button
                title={preparing ? 'Preparing…' : photoUri ? 'Retake' : 'Add photo'}
                icon={CameraIcon}
                variant="tonal"
                size="small"
                onPress={() => setCameraOpen(true)}
                disabled={busy}
              />
              {photoUri && (
                <Button title="Remove" variant="secondary" size="small" onPress={removePhoto} disabled={busy} />
              )}
            </View>
            <ErrorText error={photoError} />
          </View>

          <Text style={styles.hint}>{text.privacy}</Text>
          <CameraCapture visible={cameraOpen} onCapture={addPhoto} onClose={() => setCameraOpen(false)} />
        </ScrollView>
        {/* Send stays in sight below the form, which runs long with a rate open. */}
        <View style={[styles.footer, { paddingBottom: 12 + insets.bottom }]}>
          <ErrorText error={sendError ?? (email ? null : accountError)} />
          {email ? (
            <Button title={sending ? 'Sending…' : 'Send report'} onPress={send} disabled={busy} />
          ) : (
            <Button
              title="Sign in to send"
              onPress={() => router.push({ pathname: '/account', params: { from: 'report' } })}
              disabled={busy}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const createStyles = (c) =>
  StyleSheet.create({
    screen: { flex: 1 },
    container: { padding: 16, gap: space },
    intro: { fontSize: 15, lineHeight: 22, color: c.text },
    hint: { fontSize: 13, lineHeight: 18, color: c.muted },
    foldCard: { backgroundColor: c.card, borderRadius: radius.card, overflow: 'hidden', boxShadow: c.shadow },
    card: { backgroundColor: c.card, borderRadius: radius.card, padding: 16, gap: 8, boxShadow: c.shadow },
    cardTitle: { fontSize: 17, fontWeight: '600', color: c.text },
    photo: { width: 120, height: 160, borderRadius: radius.control },
    row: { flexDirection: 'row', gap: 8 },
    footer: {
      paddingHorizontal: 16,
      paddingTop: 12,
      gap: 8,
      backgroundColor: c.background,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
  });
