import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '../components/Button';
import { CameraCapture } from '../components/CameraCapture';
import { ChipGroup } from '../components/ChipGroup';
import { ErrorText } from '../components/ErrorText';
import { Field } from '../components/Field';
import { CameraIcon } from '../components/icons';
import { PhotoStrip } from '../components/PhotoStrip';
import { PhotoViewer } from '../components/PhotoViewer';
import { PlacePicker } from '../components/PlacePicker';
import { RateForm } from '../components/RateForm';
import { SwitchRow } from '../components/SwitchRow';
import { radius, space } from '../components/theme';
import { useThemedStyles } from '../components/ThemeProvider';
import {
  deletePhotoFiles,
  holidays,
  places,
  preparePhoto,
  savingPhotos,
  sessions,
  useDatabase,
  vehicles,
} from '../db';
import {
  dayTypeOf,
  enteredRates,
  offersSameEveryDay,
  placeRatesFormFrom,
  planRateSave,
  rateDayTypeFor,
  ratesToSave,
} from '../fees';
import { useFocusedLoad } from '../hooks/useFocusedLoad';
import { indexAfterRemoval } from '../lib/listIndex';
import { typedPlaceToConfirm } from '../lib/placeName';
import { formatMinutes } from '../lib/time';
import { shouldReadNextPhoto, suggestionsFromPhotos } from '../ocr/pillarText';
import { readPhotoText } from '../ocr/readText';
import { holidayAmountHint, keepPlaceLabel, rateUpdateQuestion, typedPlaceQuestion } from '../text/parkText';
import { addPhotoLabel } from '../text/photoText';
import { dayTypeLabel } from '../text/rateText';
import { TIMER_OPTIONS, timerEndFrom } from '../timer/timer';
import { ZONE_COLOURS } from '../zone/zoneColour';

const ZONE_OPTIONS = ZONE_COLOURS.map((c) => ({ value: c.name, label: c.name, swatch: c.swatch }));
const ACCESS_OPTIONS = [
  { value: 'lift', label: 'Lift' },
  { value: 'escalator', label: 'Escalator' },
  { value: 'stairs', label: 'Stairs' },
  { value: 'other', label: 'Other' },
];
const TIMER_CHIPS = TIMER_OPTIONS.map((minutes) => ({ value: minutes, label: formatMinutes(minutes) }));

const EMPTY_FORM = { level: '', bay: '', zone_colour_name: null, access_type: null, landmark: '', note: '' };
const NO_SAVED_RATES = { weekday: null, weekend: null, holiday: null };

// Only the Save handler reads the clock. The React Compiler lint cannot tell
// that handler from render code, so the read lives outside the component.
const parkedAt = () => Date.now();

// Park: record where a car is, the place and its rate, and an optional timer.
// Opened with ?vehicleId=<id>.
export default function Park() {
  const db = useDatabase();
  const styles = useThemedStyles(createStyles);
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const { vehicleId } = useLocalSearchParams();
  const load = useCallback(async () => {
    const [car, holidayDates] = await Promise.all([vehicles.get(db, vehicleId), holidays.dateSet(db)]);
    return { car, holidayDates };
  }, [db, vehicleId]);
  const { data, error: loadError, loading } = useFocusedLoad(load);
  // The moment whose day type the rate form is for. Save moves it on when
  // the screen stayed open into a different day type.
  const [formDay, setFormDay] = useState(Date.now);
  const [form, setForm] = useState(EMPTY_FORM);
  const [place, setPlace] = useState(null);
  // What is typed in the picker's search box, trimmed: a name never tapped.
  const [typedPlace, setTypedPlace] = useState('');
  // The chosen place's saved rates and its rate card as typed. form is
  // placeRatesFormFrom's: weekday and weekend keep their own form, so switching
  // Public holiday on and off never loses what was typed. null: no place, or
  // its rates are loading.
  const [rateInput, setRateInput] = useState(null);
  const [ratesError, setRatesError] = useState(null);
  const [holidaySwitch, setHolidaySwitch] = useState(false);
  const [timerMinutes, setTimerMinutes] = useState(null);
  // Prepared photos in the cache, the pillar sign first: [{ uri, ocrText }],
  // ocrText null for a photo OCR did not read. They are kept in the app's
  // storage only when the car is parked.
  const [taken, setTaken] = useState([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  // null, 'preparing' (shrinking the photo) or 'reading' (OCR).
  const [photoStep, setPhotoStep] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [photoError, setPhotoError] = useState(null);
  const photoUris = taken.map((photo) => photo.uri);
  // Photos taken but never saved are deleted when Park closes. Saving has
  // already deleted the ones it kept copies of, so those are skipped.
  const unsavedPhotos = useRef([]);
  useEffect(() => {
    unsavedPhotos.current = taken.map((photo) => photo.uri);
  }, [taken]);
  useEffect(() => () => deletePhotoFiles(unsavedPhotos.current), []);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  // Only the latest place choice may fill in the rates.
  const placeRequest = useRef(0);
  // True while a question is looked up or open. Save stays enabled behind it,
  // so a quick second tap must not open a second question on top.
  const asking = useRef(false);

  const setField = (field) => (value) => setForm((current) => ({ ...current, [field]: value }));
  const updateRateInput = (change) => setRateInput((current) => current && { ...current, ...change(current) });

  // OCR reads the first photo, and the next only while the ones before gave
  // no level or bay. A photo OCR cannot read is still kept.
  const addPhoto = async (picture) => {
    setCameraOpen(false);
    setPhotoStep('preparing');
    setPhotoError(null);
    let uri;
    try {
      uri = await preparePhoto(picture);
    } catch (e) {
      setPhotoError(e);
      setPhotoStep(null);
      return;
    }
    let ocrText = null;
    if (shouldReadNextPhoto(taken.map((photo) => photo.ocrText))) {
      setPhotoStep('reading');
      try {
        ocrText = await readPhotoText(uri);
      } catch (e) {
        setPhotoError(new Error(`Could not read the sign: ${String(e?.message ?? e)}. Type the level and bay below.`));
      }
    }
    setTaken((current) => [...current, { uri, ocrText }]);
    setPhotoStep(null);
  };

  const confirmRemovePhoto = (index) =>
    Alert.alert('Remove this photo?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          deletePhotoFiles([taken[index].uri]);
          setTaken((current) => current.filter((_, i) => i !== index));
          setViewing(indexAfterRemoval(index, taken.length));
        },
      },
    ]);

  const choosePlace = async (next) => {
    const request = ++placeRequest.current;
    setPlace(next);
    setRateInput(null);
    setRatesError(null);
    if (!next) return;
    try {
      // A typed name can still be a saved place the short list did not show;
      // using that place means its saved rates are asked about, not replaced.
      let chosen = next;
      if (!chosen.id) {
        const existing = await places.findByName(db, chosen.name);
        if (existing) chosen = { id: existing.id, name: existing.name };
      }
      const saved = chosen.id ? await places.getRates(db, chosen.id) : NO_SAVED_RATES;
      if (request !== placeRequest.current) return;
      setPlace(chosen);
      setRateInput({ saved, form: placeRatesFormFrom(saved), sameEveryDay: false });
    } catch (e) {
      if (request === placeRequest.current) setRatesError(e);
    }
  };

  if (loadError) return <ErrorText error={loadError} />;
  if (loading) return null;
  if (!data.car) return <ErrorText error={new Error('This car no longer exists.')} />;

  const { car, holidayDates } = data;
  const todayType = dayTypeOf(formDay, holidayDates);
  const todayIsHoliday = todayType === 'holiday';
  const holidayOn = todayIsHoliday || holidaySwitch;
  const rateDayType = rateDayTypeFor(todayType, holidayOn);
  const hasSavedRate = Boolean(rateInput?.saved[rateDayType]);
  // A chosen place's rates must be loaded first: without them every typed
  // rate would count as new and replace a saved one without asking.
  const canSave = !saving && !photoStep && (!place || rateInput != null);
  const ocrTexts = taken.map((photo) => photo.ocrText);
  const suggestions = suggestionsFromPhotos(ocrTexts);
  const hasSuggestions = suggestions.levels.length > 0 || suggestions.bays.length > 0;
  const readNothing = !hasSuggestions && ocrTexts.some((text) => text != null);

  const start = async ({
    started_at,
    place_name = place?.name ?? null,
    rates,
    save_rates,
    public_holiday = Boolean(place) && holidaySwitch && !todayIsHoliday,
  }) => {
    setSaving(true);
    setSaveError(null);
    try {
      const id = await savingPhotos(photoUris, (keptUris) =>
        sessions.start(db, {
          vehicle_id: vehicleId,
          ...form,
          started_at,
          place_name,
          rates,
          save_rates,
          public_holiday,
          timer_ends_at: timerMinutes ? timerEndFrom(started_at, timerMinutes) : null,
          // The raw text is kept, so the parser can be improved with real photos.
          photo_files: keptUris.map((file_uri, i) => ({ file_uri, ocr_text: taken[i].ocrText })),
        })
      );
      router.replace(`/session/${id}`);
    } catch (e) {
      setSaveError(e);
      setSaving(false);
    }
  };

  // Every answer frees Save again. Android places three buttons as neutral,
  // negative and positive, in this order. Its dialogs cannot be dismissed
  // without a button by default; onDismiss covers it if one ever is.
  const ask = (question, buttons) => {
    asking.current = true;
    const answered = (onPress) => () => {
      asking.current = false;
      onPress?.();
    };
    Alert.alert(
      question,
      undefined,
      buttons.map((button) => ({ ...button, onPress: answered(button.onPress) })),
      { onDismiss: answered() }
    );
  };

  // Parks at the place chosen in the picker with its rate card, or with no place.
  const parkAtChosen = (started_at) => {
    if (!place) {
      start({ started_at, rates: null, save_rates: [] });
      return;
    }
    // Past midnight the form may show the wrong day's rate: show the right
    // one and let the user check it before parking.
    if (dayTypeOf(started_at, holidayDates) !== todayType) {
      setFormDay(started_at);
      setSaveError(new Error('The day changed while Park was open. Check the rate, then tap Save again.'));
      return;
    }
    const { entered, error } = enteredRates({
      saved: rateInput.saved,
      dayType: rateDayType,
      form: rateInput.form[rateDayType],
      sameEveryDay: rateInput.sameEveryDay,
      holidayOn,
      holidayAmount: rateInput.form.holidayAmount,
    });
    if (error) {
      setSaveError(new Error(error));
      return;
    }
    const plan = planRateSave(rateInput.saved, entered);
    const question = rateUpdateQuestion(plan.changed, place.name);
    if (!question) {
      start({ started_at, rates: entered, save_rates: ratesToSave(plan, false) });
      return;
    }
    // Cancel goes back to the form, for a rate typed by mistake (PLAN.md, "User flow").
    ask(question, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Only this time', onPress: () => start({ started_at, rates: entered, save_rates: ratesToSave(plan, false) }) },
      { text: 'Yes, update', onPress: () => start({ started_at, rates: entered, save_rates: ratesToSave(plan, true) }) },
    ]);
  };

  // A name typed in the picker but never tapped would otherwise be dropped
  // without a word: with no place chosen the car parked with no place,
  // and after Change it parked at the place chosen before. "Use it" parks at
  // the typed place with no typed rate in both cases: the chosen place's rate
  // card (and its Public holiday switch) is for that place. A
  // saved place's saved rates still go into the snapshot (sessions.start), and
  // a new place's rate is asked for at Found my car, so no rate question follows.
  const askTypedPlace = async (started_at, typed) => {
    asking.current = true;
    let saved;
    try {
      saved = await places.findByName(db, typed);
    } catch (e) {
      asking.current = false;
      setSaveError(e);
      return;
    }
    const other = place
      ? { text: keepPlaceLabel(place.name), onPress: () => parkAtChosen(started_at) }
      : { text: 'No place', onPress: () => start({ started_at, place_name: null, rates: null, save_rates: [] }) };
    ask(typedPlaceQuestion(typed, saved?.name), [
      { text: 'Cancel', style: 'cancel' },
      other,
      {
        text: 'Use it',
        onPress: () =>
          start({ started_at, place_name: saved?.name ?? typed, rates: null, save_rates: [], public_holiday: false }),
      },
    ]);
  };

  const save = () => {
    if (asking.current) return;
    setSaveError(null);
    // Read once: the session's start and the timer's start are the same moment.
    const started_at = parkedAt();
    const typed = typedPlaceToConfirm(place, typedPlace);
    if (typed) {
      askTypedPlace(started_at, typed);
      return;
    }
    parkAtChosen(started_at);
  };

  return (
    // Android draws edge to edge, so the window no longer shrinks for the
    // keyboard; the padding keeps the end of the form (Save) reachable.
    <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={headerHeight} style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: 16 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
      >
        <Stack.Screen options={{ title: `Park ${car.name}` }} />

        <PlacePicker value={place} onChange={choosePlace} onQueryChange={setTypedPlace} />
        <ErrorText error={ratesError} />

        {place && rateInput && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{dayTypeLabel(rateDayType)} rate</Text>
              <Text style={styles.hint}>
                {hasSavedRate
                  ? 'Filled in from your saved rate.'
                  : "Saved to this place for next time. Leave it empty if you don't know it."}
              </Text>
            </View>
            <RateForm
              value={rateInput.form[rateDayType]}
              onChange={(next) => updateRateInput((current) => ({ form: { ...current.form, [rateDayType]: next } }))}
            />
            {offersSameEveryDay(rateInput.saved, rateDayType) && (
              <SwitchRow
                label="Same rate every day"
                hint="Saves it as the weekday and weekend rate."
                value={rateInput.sameEveryDay}
                onValueChange={(sameEveryDay) => updateRateInput(() => ({ sameEveryDay }))}
              />
            )}
            <View style={styles.divider} />
            <SwitchRow
              label="Public holiday"
              hint={
                todayIsHoliday
                  ? 'Today is in your holiday list. Remove it in Settings > Public holidays.'
                  : 'Adds today to your public holiday list.'
              }
              value={holidayOn}
              onValueChange={setHolidaySwitch}
              disabled={todayIsHoliday}
            />
            {holidayOn && (
              <>
                <Field
                  label="Public holiday amount (RM, per entry)"
                  value={rateInput.form.holidayAmount}
                  onChangeText={(holidayAmount) =>
                    updateRateInput((current) => ({ form: { ...current.form, holidayAmount } }))
                  }
                  placeholder="Optional"
                  keyboardType="decimal-pad"
                />
                <Text style={styles.hint}>{holidayAmountHint(Boolean(rateInput.saved.holiday))}</Text>
              </>
            )}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.label}>Photos</Text>
          <Text style={styles.hint}>Start with the pillar sign. Add more if they help you remember the spot.</Text>
          {/* Closed while a photo is prepared or read: removing one then would
              change which photo OCR should read. */}
          <PhotoStrip uris={photoUris} onOpen={setViewing} disabled={Boolean(photoStep)} />
          {photoStep && (
            <Text style={styles.hint}>{photoStep === 'reading' ? 'Reading the sign…' : 'Preparing photo…'}</Text>
          )}
          {readNothing && !form.level && !form.bay && (
            <Text style={styles.hint}>No level or bay found in the photo. Type them below.</Text>
          )}
          <ErrorText error={photoError} />
          <View style={styles.sideActions}>
            <Button
              title={addPhotoLabel(photoUris.length)}
              variant="tonal"
              size="small"
              icon={CameraIcon}
              onPress={() => setCameraOpen(true)}
              disabled={Boolean(photoStep) || saving}
            />
          </View>
        </View>

        {hasSuggestions && (
          <View style={styles.section}>
            <Text style={styles.label}>From the photo</Text>
            <Text style={styles.hint}>Tap to fill in the level and bay. You can still type them.</Text>
            {suggestions.levels.length > 0 && (
              <ChipGroup
                options={suggestions.levels.map((level) => ({ value: level, label: `Level ${level}` }))}
                value={form.level}
                onChange={(level) => setField('level')(level ?? '')}
              />
            )}
            {suggestions.bays.length > 0 && (
              <ChipGroup
                options={suggestions.bays.map((bay) => ({ value: bay, label: `Bay ${bay}` }))}
                value={form.bay}
                onChange={(bay) => setField('bay')(bay ?? '')}
              />
            )}
          </View>
        )}
        <CameraCapture visible={cameraOpen} onCapture={addPhoto} onClose={() => setCameraOpen(false)} />
        <PhotoViewer
          uris={photoUris}
          index={viewing}
          onClose={() => setViewing(null)}
          onDelete={confirmRemovePhoto}
        />

        <View style={styles.row}>
          <View style={styles.half}>
            <Field label="Level" value={form.level} onChangeText={setField('level')} placeholder="B2" autoCapitalize="characters" />
          </View>
          <View style={styles.half}>
            <Field label="Bay" value={form.bay} onChangeText={setField('bay')} placeholder="C14" autoCapitalize="characters" />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Zone colour</Text>
          <ChipGroup options={ZONE_OPTIONS} value={form.zone_colour_name} onChange={setField('zone_colour_name')} />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>How you left the car park</Text>
          <ChipGroup options={ACCESS_OPTIONS} value={form.access_type} onChange={setField('access_type')} />
        </View>

        <Field
          label="First shop you saw"
          value={form.landmark}
          onChangeText={setField('landmark')}
          placeholder="Starbucks"
        />
        <Field label="Note" value={form.note} onChangeText={setField('note')} multiline />

        <View style={styles.section}>
          <Text style={styles.label}>Timer</Text>
          <Text style={styles.hint}>Optional, such as the time you paid for.</Text>
          <ChipGroup options={TIMER_CHIPS} value={timerMinutes} onChange={setTimerMinutes} />
        </View>

        <View style={styles.section}>
          <ErrorText error={saveError} />
          <Button title={saving ? 'Saving…' : 'Save'} onPress={save} disabled={!canSave} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (c) =>
  StyleSheet.create({
    screen: { flex: 1 },
    container: { padding: 16, gap: 20 },
    section: { gap: 8 },
    row: { flexDirection: 'row', gap: space },
    half: { flex: 1 },
    label: { fontWeight: '600', color: c.text },
    hint: { fontSize: 13, color: c.muted },
    card: { backgroundColor: c.card, borderRadius: radius.card, padding: 16, gap: 10, boxShadow: c.shadow },
    cardHeader: { gap: 2 },
    cardTitle: { fontSize: 17, fontWeight: '600', color: c.text },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: c.border },
    // A row, so the small pill sits at the start instead of stretching.
    sideActions: { flexDirection: 'row' },
  });
