import { useEffect, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { places, useDatabase } from '../db';
import { isNewPlaceName } from '../lib/placeName';
import { addPlaceLabel } from '../text/parkText';
import { Button } from './Button';
import { ErrorText } from './ErrorText';
import { MapPinIcon, PlusIcon, SearchIcon, XIcon } from './icons';
import { radius } from './theme';
import { useAppTheme, useThemedStyles } from './ThemeProvider';

// Short lists keep the long Park form short.
const RECENT_LIMIT = 5;
const MATCH_LIMIT = 8;
const ICON_SIZE = 18;

// Picks where the car is parked: recent places first, matches while typing,
// a typed name as a new place, or No place (free or unknown parking).
// value: { id, name } for a saved place, { id: null, name } for a new one, or
// null for no place. onChange gets the same shape. Nothing is picked until the
// user taps a row, so a blank picker means no place. onQueryChange (optional)
// gets the search text, trimmed, and '' once it is cleared or a row is tapped,
// so the screen can ask about a name typed but never tapped.
export function PlacePicker({ value, onChange, onQueryChange }) {
  const db = useDatabase();
  const { colours } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  // 'search' (nothing picked yet), 'chosen', or 'change' (searching again,
  // with the current choice kept until another row is tapped).
  const [mode, setMode] = useState(value == null ? 'search' : 'chosen');
  const [query, setQuery] = useState('');
  const [result, setResult] = useState(null); // { query, rows } of the last search
  const [error, setError] = useState(null);
  const open = mode !== 'chosen';
  const typed = query.trim();

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    places.search(db, typed, { limit: typed ? MATCH_LIMIT : RECENT_LIMIT }).then(
      (rows) => {
        if (cancelled) return;
        setResult({ query: typed, rows });
        setError(null);
      },
      (e) => {
        if (!cancelled) setError(e);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [db, open, typed]);

  const changeQuery = (text) => {
    setQuery(text);
    onQueryChange?.(text.trim());
  };
  const close = () => {
    Keyboard.dismiss();
    setMode('chosen');
    changeQuery('');
  };
  const choose = (next) => {
    close();
    onChange(next);
  };

  const rows = result?.rows ?? [];
  // Only offer to add once the list shows matches for exactly what is typed.
  const canAdd = result?.query === typed && isNewPlaceName(rows, typed);

  return (
    <View style={styles.picker}>
      <Text style={styles.label}>Place</Text>

      {mode !== 'search' && (
        <View style={styles.chosen}>
          <View style={styles.chosenIcon}>
            <MapPinIcon size={ICON_SIZE} color={value ? colours.text : colours.muted} />
          </View>
          <View style={styles.rowText}>
            <Text style={value ? styles.chosenName : styles.chosenNameMuted} numberOfLines={2}>
              {value ? value.name : 'No place'}
            </Text>
            {!value && <Text style={styles.hint}>Free or unknown parking, no fee</Text>}
            {value && value.id == null && <Text style={styles.hint}>New place, saved when you park</Text>}
          </View>
          {mode === 'chosen' ? (
            <Button title="Change" variant="secondary" size="small" onPress={() => setMode('change')} />
          ) : (
            // Cancel keeps the choice without calling onChange, so the screen
            // keeps the rates typed for it.
            <Button title="Cancel" variant="secondary" size="small" onPress={close} />
          )}
        </View>
      )}

      {open && (
        <>
          <View style={styles.search}>
            <SearchIcon size={ICON_SIZE} color={colours.muted} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={changeQuery}
              placeholder="Search or type a new place"
              placeholderTextColor={colours.muted}
              selectionColor={colours.accent}
              accessibilityLabel="Search places"
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="done"
            />
            {query !== '' && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                hitSlop={12}
                onPress={() => changeQuery('')}
              >
                <XIcon size={ICON_SIZE} color={colours.muted} />
              </Pressable>
            )}
          </View>
          <ErrorText error={error} />
          {result && rows.length === 0 && !typed && (
            <Text style={styles.hint}>Type the car park&apos;s name to add it.</Text>
          )}

          <View style={styles.card}>
            {rows.map((place, index) => (
              <Row
                key={place.id}
                first={index === 0}
                onPress={() => choose({ id: place.id, name: place.name })}
                styles={styles}
              >
                <MapPinIcon size={ICON_SIZE} color={colours.muted} />
                <Text style={styles.name} numberOfLines={2}>
                  {place.name}
                </Text>
              </Row>
            ))}
            {canAdd && (
              <Row first={rows.length === 0} onPress={() => choose({ id: null, name: typed })} styles={styles}>
                <PlusIcon size={ICON_SIZE} color={colours.accent} />
                <Text style={styles.addText} numberOfLines={2}>
                  {addPlaceLabel(typed)}
                </Text>
              </Row>
            )}
            <Row first={rows.length === 0 && !canAdd} onPress={() => choose(null)} styles={styles}>
              <View style={styles.iconSpace} />
              <View style={styles.rowText}>
                <Text style={styles.noPlace}>No place</Text>
                <Text style={styles.hint}>Free or unknown parking, no fee</Text>
              </View>
            </Row>
          </View>
        </>
      )}
    </View>
  );
}

function Row({ first, onPress, styles, children }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, !first && styles.divider, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );
}

const createStyles = (c) =>
  StyleSheet.create({
    picker: { gap: 8 },
    label: { fontWeight: '600', color: c.text },
    chosen: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: c.card,
      borderRadius: radius.card,
      paddingVertical: 12,
      paddingLeft: 12,
      paddingRight: 14,
      boxShadow: c.shadow,
    },
    chosenIcon: {
      width: 36,
      height: 36,
      borderRadius: radius.pill,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chosenName: { fontSize: 17, fontWeight: '600', color: c.text },
    chosenNameMuted: { fontSize: 17, fontWeight: '600', color: c.muted },
    search: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      borderRadius: radius.control,
      paddingHorizontal: 14,
    },
    searchInput: { flex: 1, paddingVertical: 12, fontSize: 16, color: c.text },
    card: { backgroundColor: c.card, borderRadius: radius.card, overflow: 'hidden', boxShadow: c.shadow },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, minHeight: 48 },
    divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    pressed: { backgroundColor: c.surface },
    iconSpace: { width: ICON_SIZE },
    rowText: { flex: 1, gap: 2 },
    name: { flex: 1, fontSize: 16, color: c.text },
    noPlace: { fontSize: 16, color: c.text },
    addText: { flex: 1, fontSize: 16, fontWeight: '600', color: c.text },
    hint: { fontSize: 13, color: c.muted },
  });
