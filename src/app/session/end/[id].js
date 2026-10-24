import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '../../../components/Button';
import { ErrorText } from '../../../components/ErrorText';
import { EstimatePill } from '../../../components/EstimatePill';
import { Field } from '../../../components/Field';
import { RateForm } from '../../../components/RateForm';
import { radius, space } from '../../../components/theme';
import { useThemedStyles } from '../../../components/ThemeProvider';
import { holidays, places, sessions, useDatabase } from '../../../db';
import {
  amountPaidText,
  EMPTY_RATE_FORM,
  missingRateTypes,
  readEndForm,
  savesMissingRate,
  sessionFee,
  typedRates,
} from '../../../fees';
import { useFocusedLoad } from '../../../hooks/useFocusedLoad';
import { formatRM } from '../../../lib/money';
import { formatDuration } from '../../../lib/time';
import { missingRateHint, missingRateTitle, stayTimesText } from '../../../text/findText';
import { missingRateText } from '../../../text/rateText';

const NO_ERRORS = { rateErrors: {}, paidError: null };

// Found my car: the summary that ends a parked session (PLAN.md, "Returning").
// Opened from Find with the session id. It shows the stay and its fee, asks for
// a rate the stay was missing, and takes the amount paid.
export default function FoundMyCar() {
  const db = useDatabase();
  const styles = useThemedStyles(createStyles);
  const headerHeight = useHeaderHeight();
  const { id } = useLocalSearchParams();
  // The end time is fixed when the summary opens, so the fee shown is the fee
  // sessions.end stores.
  const [endedAt] = useState(Date.now);
  const load = useCallback(async () => {
    const [session, holidayDates] = await Promise.all([sessions.getDetails(db, id), holidays.dateSet(db)]);
    // The place's rates now, null when it was deleted: they decide whether a
    // missing rate typed here is saved to it.
    const place = session?.place_id ? await places.get(db, session.place_id) : null;
    const placeRates = place ? await places.getRates(db, place.id) : null;
    return { session, holidayDates, placeRates };
  }, [db, id]);
  const { data, error, loading } = useFocusedLoad(load);
  const [rateForms, setRateForms] = useState({});
  // null until the user edits Amount paid; until then it follows the fee.
  const [typedPaid, setTypedPaid] = useState(null);
  const [formErrors, setFormErrors] = useState(NO_ERRORS);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  if (error) return <ErrorText error={error} />;
  if (loading) return null;
  const { session, holidayDates, placeRates } = data;
  if (!session) return <ErrorText error={new Error('This parking session no longer exists.')} />;
  if (session.status !== 'active') return <ErrorText error={new Error('This parking session has already ended.')} />;
  // Only if the phone's clock was set back after parking; the fee cannot be priced then.
  if (endedAt < session.started_at) {
    return <ErrorText error={new Error("The phone's clock is before the time you parked. Check the time, then try again.")} />;
  }

  // The day types to ask for come from the stay and its snapshot, not the
  // typed rates, so a form stays on screen once its rate is complete.
  const dayTypes = missingRateTypes(session, endedAt, holidayDates);
  // Without the typed rates the fee is an estimate, or unknown when a day has
  // no rate to borrow (no rate at all, or only a holiday amount). A stay
  // inside the free minutes is no estimate either: it shows no Estimate pill.
  const estimated = sessionFee(session, endedAt, holidayDates)?.isEstimate === true;
  const fee = sessionFee(session, endedAt, holidayDates, typedRates(rateForms, dayTypes));
  const missingRate = missingRateText(fee);
  const paidText = amountPaidText(fee, typedPaid);

  const setRateForm = (dayType) => (form) => setRateForms((current) => ({ ...current, [dayType]: form }));

  const save = async () => {
    const { input, rateErrors, paidError } = readEndForm({ endedAt, forms: rateForms, dayTypes, paidText });
    setFormErrors({ rateErrors, paidError });
    setSaveError(null);
    if (!input) return;
    setSaving(true);
    try {
      await sessions.end(db, session.id, input);
      // Back to Home with Find and this summary gone, so Back cannot reopen them.
      // foundAt tells Home to drive the car off with a small celebration.
      router.dismissTo({ pathname: '/', params: { foundAt: String(endedAt), foundCarId: session.vehicle_id } });
    } catch (e) {
      setSaveError(e);
      setSaving(false);
    }
  };

  return (
    // As on Park: Android draws edge to edge, so the window no longer shrinks
    // for the keyboard; the padding keeps Amount paid and Save reachable.
    <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={headerHeight} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Stack.Screen options={{ title: 'Found my car' }} />

        <View style={styles.card}>
          {session.place_name && <Text style={styles.place}>{session.place_name}</Text>}
          <Text style={styles.body}>{stayTimesText(session.started_at, endedAt)}</Text>
          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Duration</Text>
              <Text style={styles.statValue}>{formatDuration(endedAt - session.started_at)}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Fee</Text>
              {fee?.feeSen != null ? (
                <>
                  <Text style={styles.statValue}>{formatRM(fee.feeSen)}</Text>
                  {fee.isEstimate && <EstimatePill />}
                </>
              ) : (
                <Text style={styles.muted}>No fee calculated</Text>
              )}
            </View>
          </View>
          {missingRate && <Text style={styles.muted}>{missingRate}</Text>}
        </View>

        {dayTypes.map((dayType) => (
          <View key={dayType} style={styles.card}>
            <Text style={styles.cardTitle}>{missingRateTitle(dayType, session.place_name)}</Text>
            <Text style={styles.muted}>
              {missingRateHint(session.place_name, savesMissingRate(placeRates, dayType), estimated)}
            </Text>
            <RateForm
              value={rateForms[dayType] ?? EMPTY_RATE_FORM}
              onChange={setRateForm(dayType)}
              disabled={saving}
            />
            <ErrorText error={formErrors.rateErrors[dayType]} />
          </View>
        ))}

        {/* The overnight note sits right above Amount paid: it is about that field. */}
        {fee?.overnight && (
          <View style={styles.overnight}>
            <Text style={styles.overnightText}>Overnight: check your receipt</Text>
          </View>
        )}
        <View style={styles.block}>
          <Field
            label="Amount paid (RM)"
            value={paidText}
            onChangeText={setTypedPaid}
            placeholder="e.g. 5.00"
            keyboardType="decimal-pad"
            editable={!saving}
          />
          <ErrorText error={formErrors.paidError} />
        </View>

        <ErrorText error={saveError} />
        <Button title={saving ? 'Saving…' : 'Save'} onPress={save} disabled={saving} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (c) =>
  StyleSheet.create({
    screen: { flex: 1 },
    container: { padding: 16, gap: space },
    card: { backgroundColor: c.card, borderRadius: radius.card, padding: 16, gap: 8, boxShadow: c.shadow },
    place: { fontSize: 17, fontWeight: '600', color: c.text },
    cardTitle: { fontSize: 16, fontWeight: '600', color: c.text },
    body: { color: c.text, lineHeight: 20 },
    muted: { color: c.muted, lineHeight: 20 },
    stats: {
      flexDirection: 'row',
      gap: space,
      paddingTop: 10,
      marginTop: 2,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
    stat: { flex: 1, gap: 4, alignItems: 'flex-start' },
    statLabel: { color: c.muted, fontSize: 13, fontWeight: '600' },
    statValue: { color: c.text, fontSize: 24, fontWeight: '700' },
    overnight: {
      backgroundColor: c.warningSoft,
      borderRadius: radius.control,
      paddingVertical: 12,
      paddingHorizontal: 14,
    },
    overnightText: { color: c.warning, fontWeight: '600' },
    block: { gap: 4 },
  });
