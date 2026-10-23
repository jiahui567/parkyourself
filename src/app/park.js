import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '../components/Button';
import { CameraCapture } from '../components/CameraCapture';
import { ChipGroup } from '../components/ChipGroup';
import { Disclosure } from '../components/Disclosure';
import { ErrorText } from '../components/ErrorText';
import { Field } from '../components/Field';
import { CameraIcon, MapPinIcon, NoteIcon, TimerIcon } from '../components/icons';
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
import { useParkLocation } from '../hooks/useParkLocation';
import { isUsableReading } from '../lib/geo';
import { indexAfterRemoval } from '../lib/listIndex';
import { typedPlaceToConfirm } from '../lib/placeName';
import { formatMinutes } from '../lib/time';
import { placeForReading, shouldFillPlace } from '../location/autoPlace';
import { lookUpPlaceName } from '../location/readLocation';
import {
  codeRows,
  fillFromSign,
  pickCode,
  readSign,
  shouldReadNextPhoto,
  suggestionsFromPhotos,
  zoneFromPhotos,
} from '../ocr/pillarText';
import { readPhotoText } from '../ocr/readText';
import {
  allowLocationLabel,
  autoPlaceHint,
  LOCATION_PURPOSE,
  locationHint,
  locationRowValue,
} from '../text/locationText';
import {
  holidayRateHint,
  keepPlaceLabel,
  parkRateRowText,
  photoCodesHint,
  rateUpdateQuestion,
  typedPlaceQuestion,
} from '../text/parkText';
import { addPhotoLabel } from '../text/photoText';
import { TIMER_OPTIONS, timerEndFrom } from '../timer/timer';
import { sampleSignColour } from '../zone/photoColour';
import { ZONE_COLOURS } from '../zone/zoneColour';

const ZONE_OPTIONS = ZONE_COLOURS.map((c) => ({ value: c.name, label: c.name, swatch: c.swatch }));
const TIMER_CHIPS = TIMER_OPTIONS.map((minutes) => ({ value: minutes, label: formatMinutes(minutes) }));

// How the user left the car park and the first shop they saw are added on
// Find as they walk out: at the car, when Save is tapped, they are not known yet.
const EMPTY_FORM = { level: '', bay: '', zone_colour_name: null, zone_colour_hex: null, note: '' };
const NO_SAVED_RATES = { weekday: null, weekend: null, holiday: null };
// The optional parts start folded, so parking takes a place, a photo and Save.
const ALL_CLOSED = { rate: false, timer: false, note: false, location: false };

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
  // placeRatesFormFrom's: weekday and weekend keep their own form, so a day
  // change while Park is open never loses what was typed. null: no place, or
  // its rates are loading.
  const [rateInput, setRateInput] = useState(null);
  const [ratesError, setRatesError] = useState(null);
  const [timerMinutes, setTimerMinutes] = useState(null);
  const [open, setOpen] = useState(ALL_CLOSED);
  // Prepared photos in the cache, the pillar sign first: [{ uri, read, sampled }],
  // read the OCR result (readText.js), null for a photo OCR did not read, and
  // sampled the colour read off the sign's paint ({ name, hex }) or null. They
  // are kept in the app's storage only when the car is parked.
  const [taken, setTaken] = useState([]);
  // Set once the user picks a zone colour chip: from then on a photo never
  // replaces their choice, None included.
  const zoneTouched = useRef(false);
  // True while the zone colour shown is the one the photo suggested.
  const [zoneFromPhoto, setZoneFromPhoto] = useState(false);
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
  // The location, when allowed (PLAN.md, "Location"): it fills in the place
  // and is saved with the session unless switched off.
  const gps = useParkLocation();
  const [saveLocation, setSaveLocation] = useState(true);
  const [allowing, setAllowing] = useState(false);
  const [locationError, setLocationError] = useState(null);
  // True while the chosen place is the one the location filled in.
  const [placeFromLocation, setPlaceFromLocation] = useState(false);
  // Set once the user picks or types a place: from then on the location
  // never replaces their choice.
  const placeTouched = useRef(false);
  // The place is filled in once (autoPlace.js); busy while it is looked up.
  const filling = useRef({ busy: false, done: false });
  const fillPlace = useRef(null);

  const setField = (field) => (value) => setForm((current) => ({ ...current, [field]: value }));
  const updateRateInput = (change) => setRateInput((current) => current && { ...current, ...change(current) });
  const toggle = (part) => () => setOpen((current) => ({ ...current, [part]: !current[part] }));
  // A rate to check opens its row, so the user does not have to find it.
  const openRate = () => setOpen((current) => ({ ...current, rate: true }));

  // What the photos read fills the level, bay and zone colour still empty
  // (PLAN.md, "OCR for the pillar sign"); the chips stay to change them.
  // A chip the user picked is never replaced; the hex is the photo's colour
  // and is kept whatever name is picked.
  const fillFromPhotos = (photos) => {
    const zone = zoneFromPhotos(photos);
    const name = zoneTouched.current ? null : zone?.name;
    if (name && form.zone_colour_name == null) setZoneFromPhoto(true);
    setForm((current) => {
      let next = fillFromSign(current, suggestionsFromPhotos(photos.map((photo) => photo.read)));
      if (name && current.zone_colour_name == null) next = { ...next, zone_colour_name: name };
      if (zone?.hex && current.zone_colour_hex == null) next = { ...next, zone_colour_hex: zone.hex };
      return next;
    });
  };

  // OCR reads the first photo, and the next only while the ones before gave
  // no level or bay. A photo OCR cannot read is still kept. When the sign
  // names no colour, its paint is read around the likeliest code.
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
    let read = null;
    let sampled = null;
    if (shouldReadNextPhoto(taken.map((photo) => photo.read))) {
      setPhotoStep('reading');
      try {
        read = await readPhotoText(uri);
      } catch (e) {
        setPhotoError(new Error(`Could not read the sign: ${String(e?.message ?? e)}. Type the level and bay below.`));
      }
      // The paint is read even when the sign names its colour, so the hex
      // saved beside a name is that photo's own.
      const sign = read && readSign(read);
      if (sign?.box) {
        try {
          sampled = await sampleSignColour(uri, sign.box);
        } catch (e) {
          // Only worth saying when the colour now has to be picked by hand.
          if (!sign.colour && !zoneTouched.current) {
            setPhotoError(new Error(`Could not read the zone colour: ${String(e?.message ?? e)}. Pick it below.`));
          }
        }
      }
    }
    // taken is still the current list: the strip and Add photo are disabled
    // while a photo is prepared or read, so nothing changed it meanwhile.
    const photos = [...taken, { uri, read, sampled }];
    setTaken(photos);
    fillFromPhotos(photos);
    setPhotoStep(null);
  };

  const pickZone = (name) => {
    zoneTouched.current = true;
    setZoneFromPhoto(false);
    // A hex read off the photo stays with any name: it is the photo's colour.
    setField('zone_colour_name')(name);
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

  // Fills in the place from the reading kept once reading has finished.
  // fillPlace is set after every render, so it always calls this render's choosePlace.
  useEffect(() => {
    fillPlace.current = async ({ reading, finding }) => {
      const fill = filling.current;
      if (fill.busy || !shouldFillPlace({ touched: placeTouched.current, filled: fill.done, finding, reading })) return;
      fill.busy = true;
      try {
        const next = await placeForReading(reading, {
          listSavedPlaces: () => places.listLocated(db),
          lookUpName: lookUpPlaceName,
        });
        if (next && !placeTouched.current) {
          fill.done = true;
          setLocationError(null);
          setPlaceFromLocation(true);
          choosePlace(next);
        }
      } catch (e) {
        setLocationError(new Error(`Could not name this place: ${String(e?.message ?? e)}. Pick or type it above.`));
      } finally {
        fill.busy = false;
      }
    };
  });
  useEffect(() => {
    fillPlace.current({ reading: gps.reading, finding: gps.finding });
  }, [gps.reading, gps.finding]);

  // The user's own choice, which the location never replaces.
  const pickPlace = (next) => {
    placeTouched.current = true;
    setPlaceFromLocation(false);
    choosePlace(next);
  };
  const typePlace = (text) => {
    if (text) placeTouched.current = true;
    setTypedPlace(text);
  };

  const allowLocation = async () => {
    setAllowing(true);
    setLocationError(null);
    try {
      await gps.allow();
    } catch (e) {
      setLocationError(e);
    } finally {
      setAllowing(false);
    }
  };

  if (loadError) return <ErrorText error={loadError} />;
  if (loading) return null;
  if (!data.car) return <ErrorText error={new Error('This car no longer exists.')} />;

  const { car, holidayDates } = data;
  const todayType = dayTypeOf(formDay, holidayDates);
  const todayIsHoliday = todayType === 'holiday';
  // A public holiday is a date in the holiday list (Settings > Public
  // holidays); Park has no switch for it (PLAN.md, "User flow").
  const rateDayType = rateDayTypeFor(todayType, todayIsHoliday);
  const hasSavedRate = Boolean(rateInput?.saved[rateDayType]);
  // A chosen place's rates must be loaded first: without them every typed
  // rate would count as new and replace a saved one without asking.
  const canSave = !saving && !photoStep && (!place || rateInput != null);
  const reads = taken.map((photo) => photo.read);
  const suggestions = suggestionsFromPhotos(reads);
  const hasSuggestions = suggestions.levels.length > 0 || suggestions.bays.length > 0;
  const readNothing = !hasSuggestions && reads.some((read) => read != null);
  const rows = codeRows(suggestions);
  const filledFromPhoto = rows.level.includes(form.level) || rows.bay.includes(form.bay);
  const codeChips = (codes, name) => codes.map((code) => ({ value: code, label: code, accessibilityLabel: `${name} ${code}` }));
  const pick = (field) => (code) =>
    setForm((current) => ({ ...current, ...pickCode(current, field, code, rows.level) }));
  const rateRow =
    rateInput &&
    parkRateRowText({
      dayType: rateDayType,
      form: rateInput.form[rateDayType],
      holidayOn: todayIsHoliday,
      holidayAmount: rateInput.form.holidayAmount,
      savedHoliday: rateInput.saved.holiday,
    });
  const note = form.note.trim();
  const locationAllowed = Boolean(gps.permission?.granted);
  const locationToSave = locationAllowed && saveLocation && isUsableReading(gps.reading) ? gps.reading : null;

  const start = async ({
    started_at,
    place_name = place?.name ?? null,
    rates,
    save_rates,
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
          timer_ends_at: timerMinutes ? timerEndFrom(started_at, timerMinutes) : null,
          // The raw text is kept, so the parser can be improved with real photos.
          photo_files: keptUris.map((file_uri, i) => ({ file_uri, ocr_text: taken[i].read?.text ?? null })),
          location: locationToSave,
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
      openRate();
      return;
    }
    const { entered, error } = enteredRates({
      saved: rateInput.saved,
      dayType: rateDayType,
      form: rateInput.form[rateDayType],
      sameEveryDay: rateInput.sameEveryDay,
      holidayOn: todayIsHoliday,
      holidayAmount: rateInput.form.holidayAmount,
    });
    if (error) {
      setSaveError(new Error(error));
      openRate();
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
  // card is for that place. A saved place's saved rates still go into the
  // snapshot (sessions.start), and a new place's rate is asked for at Found my
  // car, so no rate question follows.
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
          start({ started_at, place_name: saved?.name ?? typed, rates: null, save_rates: [] }),
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

        <PlacePicker
          value={place}
          onChange={pickPlace}
          onQueryChange={typePlace}
          hint={placeFromLocation && place ? autoPlaceHint(place.id == null) : null}
        >
          {place && rateInput && (
            <Disclosure
              label={rateRow.label}
              hint={rateRow.hint}
              open={open.rate}
              onToggle={toggle('rate')}
              first={false}
            >
              {todayIsHoliday && <Text style={styles.hint}>{holidayRateHint(rateInput.saved.holiday)}</Text>}
              <Text style={styles.hint}>
                {hasSavedRate
                  ? 'Filled in from your saved rate.'
                  : "Saved to this place for next time. Leave it empty if you don't know it."}
              </Text>
              {/* Keyed by day type: each form decides on its own whether its
                  "More options" start open. */}
              <RateForm
                key={rateDayType}
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
            </Disclosure>
          )}
        </PlacePicker>
        <ErrorText error={ratesError} />

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
            <Text style={styles.hint}>{photoCodesHint(rows.level, filledFromPhoto)}</Text>
            <View style={styles.codeRow}>
              <Text style={styles.codeLabel}>Level</Text>
              <View style={styles.codeChips}>
                <ChipGroup options={codeChips(rows.level, 'Level')} value={form.level} onChange={pick('level')} />
              </View>
            </View>
            <View style={styles.codeRow}>
              <Text style={styles.codeLabel}>Bay</Text>
              <View style={styles.codeChips}>
                <ChipGroup options={codeChips(rows.bay, 'Bay')} value={form.bay} onChange={pick('bay')} />
              </View>
            </View>
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
            <Field
              label="Level"
              value={form.level}
              onChangeText={setField('level')}
              placeholder="e.g. B2"
              autoCapitalize="characters"
            />
          </View>
          <View style={styles.half}>
            <Field
              label="Bay"
              value={form.bay}
              onChangeText={setField('bay')}
              placeholder="e.g. C14"
              autoCapitalize="characters"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Zone colour</Text>
          {zoneFromPhoto && form.zone_colour_name && (
            <Text style={styles.hint}>Suggested from the photo. Tap another colour if it is wrong.</Text>
          )}
          <ChipGroup options={ZONE_OPTIONS} value={form.zone_colour_name} onChange={pickZone} />
        </View>

        <View style={styles.listCard}>
          <Disclosure
            icon={TimerIcon}
            label="Timer"
            value={timerMinutes ? formatMinutes(timerMinutes) : 'Off'}
            open={open.timer}
            onToggle={toggle('timer')}
          >
            <Text style={styles.hint}>Optional, such as the time you paid for.</Text>
            <ChipGroup options={TIMER_CHIPS} value={timerMinutes} onChange={setTimerMinutes} />
          </Disclosure>
          <Disclosure
            icon={NoteIcon}
            label="Note"
            value={note ? null : 'Add'}
            hint={open.note ? null : note}
            open={open.note}
            onToggle={toggle('note')}
            first={false}
          >
            <Field
              accessibilityLabel="Note"
              value={form.note}
              onChangeText={setField('note')}
              placeholder="Anything that helps you find the car"
              multiline
              autoFocus
            />
          </Disclosure>
          <Disclosure
            icon={MapPinIcon}
            label="Location"
            value={locationRowValue({ ...gps, saveOn: saveLocation })}
            open={open.location}
            onToggle={toggle('location')}
            first={false}
          >
            {locationAllowed ? (
              <>
                <SwitchRow
                  label="Save where I parked"
                  hint={locationHint({ ...gps, saveOn: saveLocation })}
                  value={saveLocation}
                  onValueChange={setSaveLocation}
                />
                {!gps.finding && !isUsableReading(gps.reading) && (
                  <View style={styles.sideActions}>
                    <Button title="Try again" variant="tonal" size="small" onPress={gps.retry} />
                  </View>
                )}
              </>
            ) : (
              <>
                <Text style={styles.hint}>{LOCATION_PURPOSE}</Text>
                <View style={styles.sideActions}>
                  <Button
                    title={allowLocationLabel(gps.permission)}
                    variant="tonal"
                    size="small"
                    onPress={allowLocation}
                    disabled={allowing || !gps.permission}
                  />
                </View>
              </>
            )}
            <ErrorText error={locationError ?? gps.error} />
          </Disclosure>
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
    codeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space },
    // Level with the chips' text, as the chips wrap onto more lines.
    codeLabel: { width: 44, paddingTop: 9, fontWeight: '600', color: c.muted },
    codeChips: { flex: 1 },
    listCard: { backgroundColor: c.card, borderRadius: radius.card, overflow: 'hidden', boxShadow: c.shadow },
    // A row, so the small pill sits at the start instead of stretching.
    sideActions: { flexDirection: 'row' },
  });
