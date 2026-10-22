import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';

import { ChipGroup } from './ChipGroup';
import { Disclosure } from './Disclosure';
import { ErrorText } from './ErrorText';
import { Field } from './Field';
import { radius } from './theme';
import { useThemedStyles } from './ThemeProvider';

const ACCESS_OPTIONS = [
  { value: 'lift', label: 'Lift' },
  { value: 'escalator', label: 'Escalator' },
  { value: 'stairs', label: 'Stairs' },
  { value: 'other', label: 'Other' },
];

// Find's way back while the car is parked: how the user left the car park
// and the first shop they saw, which they only know after walking out, so
// they add it here instead of on Park. route is routeBackText(session). A chip
// saves when tapped and the shop when its field is left, each through
// onSave({ access_type } or { landmark }); error is the last save's. Open at
// first while neither is recorded.
export function WayBackCard({ session, route, onSave, error }) {
  const styles = useThemedStyles(createStyles);
  const recorded = Boolean(session.access_type || session.landmark);
  const [open, setOpen] = useState(!recorded);
  const [landmark, setLandmark] = useState(session.landmark ?? '');
  // Typed but not saved yet. Android can hide the keyboard without leaving
  // the field, so the shop is also saved when Find loses focus (before Found
  // my car can end the session) and when the app goes to the background,
  // where Android may close it.
  const unsaved = useRef(null);
  const latest = useRef({ onSave, saved: session.landmark });
  useEffect(() => {
    latest.current = { onSave, saved: session.landmark };
  });
  const saveLandmark = useCallback(() => {
    const text = unsaved.current;
    unsaved.current = null;
    if (text != null && text.trim() !== (latest.current.saved ?? '')) latest.current.onSave({ landmark: text });
  }, []);
  useFocusEffect(useCallback(() => saveLandmark, [saveLandmark]));
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') saveLandmark();
    });
    return () => subscription.remove();
  }, [saveLandmark]);

  const changeLandmark = (text) => {
    setLandmark(text);
    unsaved.current = text;
  };

  return (
    <View style={styles.card}>
      <Disclosure
        label="Way back"
        hint={recorded ? route : 'Add how you left and the first shop you see.'}
        open={open}
        onToggle={() => setOpen(!open)}
      >
        <Text style={styles.label}>How you left the car park</Text>
        <ChipGroup
          options={ACCESS_OPTIONS}
          value={session.access_type}
          onChange={(access_type) => onSave({ access_type })}
        />
        <Field
          label="First shop you saw"
          value={landmark}
          onChangeText={changeLandmark}
          onEndEditing={saveLandmark}
          placeholder="e.g. Starbucks"
          returnKeyType="done"
        />
        <ErrorText error={error} />
      </Disclosure>
    </View>
  );
}

const createStyles = (c) =>
  StyleSheet.create({
    card: { backgroundColor: c.card, borderRadius: radius.card, overflow: 'hidden', boxShadow: c.shadow },
    label: { fontWeight: '600', color: c.text },
  });
