import { Stack, router } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { ErrorText } from '../../components/ErrorText';
import { ListRow, ListSection } from '../../components/List';
import { SearchField } from '../../components/SearchField';
import { space } from '../../components/theme';
import { useThemedStyles } from '../../components/ThemeProvider';
import { carParks, places, useDatabase } from '../../db';
import { useFocusedLoad } from '../../hooks/useFocusedLoad';
import { filterByQuery } from '../../lib/placeSearch';
import { noPlaceMatchesText } from '../../text/carParkText';
import { visitsText } from '../../text/visitsText';

// Places: your saved places with how often you parked there, then the car
// park list, faded and view only, to look up a car park's rates (2026-10-26);
// one search finds both. Places are made on Park, so there is no add button;
// tap one of yours to edit its rates, rename or delete it.
export default function Places() {
  const db = useDatabase();
  const styles = useThemedStyles(createStyles);
  const load = useCallback(async () => {
    const [saved, listed] = await Promise.all([places.listWithVisits(db), carParks.listUnsaved(db)]);
    return { saved, listed };
  }, [db]);
  const { data, error } = useFocusedLoad(load);
  const [query, setQuery] = useState('');

  if (error) return <ErrorText error={error} />;
  if (!data) return null;

  const searching = query.trim() !== '';
  const saved = filterByQuery(data.saved, query);
  const listed = filterByQuery(data.listed, query);

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: 'Places' }} />
      <SearchField
        value={query}
        onChangeText={setQuery}
        placeholder="Search places and car parks"
        accessibilityLabel="Search places and car parks"
        autoCapitalize="words"
      />

      {/* Yours always show, even with none yet; while searching, a part with
          no match is left out. */}
      {(saved.length > 0 || !searching) && (
        <ListSection title="Your places">
          {saved.length === 0 ? (
            <Text style={styles.empty}>
              No places yet. A place is added when you type its name on Park, with the rates you enter there.
            </Text>
          ) : (
            saved.map((place, index) => (
              <ListRow
                key={place.id}
                label={place.name}
                value={visitsText(place.visits)}
                onPress={() => router.push(`/places/${place.id}`)}
                first={index === 0}
              />
            ))
          )}
        </ListSection>
      )}

      {listed.length > 0 && (
        <ListSection title="Car park list · view only" dimmed>
          {listed.map((carPark, index) => (
            <ListRow
              key={carPark.id}
              label={carPark.name}
              onPress={() => router.push(`/car-parks/${carPark.id}`)}
              first={index === 0}
            />
          ))}
        </ListSection>
      )}

      {searching && saved.length === 0 && listed.length === 0 && (
        <Text style={styles.noMatch}>{noPlaceMatchesText(query)}</Text>
      )}
    </ScrollView>
  );
}

const createStyles = (c) =>
  StyleSheet.create({
    container: { padding: 16, gap: 20 },
    empty: { paddingVertical: 14, paddingHorizontal: 16, color: c.muted, lineHeight: 20 },
    noMatch: { color: c.muted, textAlign: 'center', marginTop: space },
  });
