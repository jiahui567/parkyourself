import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Button } from '../../components/Button';
import { ChoiceSheet } from '../../components/ChoiceSheet';
import { ErrorText } from '../../components/ErrorText';
import { FilterPill } from '../../components/FilterPill';
import { enterUp } from '../../components/motion';
import { SessionCard } from '../../components/SessionCard';
import { useThemedStyles } from '../../components/ThemeProvider';
import { sessions, useDatabase } from '../../db';
import { useFocusedLoad } from '../../hooks/useFocusedLoad';
import { formatMonth } from '../../lib/time';
import { FILTER_KINDS, historyFilters, isFiltered, liveFilter, NO_FILTER } from '../../spending/historyFilter';
import { historyByMonth } from '../../spending/summary';
import { filterPillLabel, filterPillText, filterSheetOptions, filterTitleText } from '../../text/historyText';
import { totalLineText } from '../../text/spendingText';

// Each tap is a new request, so Spending moves to the month even when the
// same one was opened before. Only the tap handler reads the clock; the React
// Compiler lint cannot tell it from render code, so the read lives out here.
const tapId = () => String(Date.now());

// History: finished parking sessions, newest first, in months with each
// month's total. Pills filter by car, place and month; a month's header opens
// that month on Spending.
export default function History() {
  const db = useDatabase();
  const styles = useThemedStyles(createStyles);
  // Every session, not the default 200: each month's total must count all of its sessions.
  const load = useCallback(() => sessions.listHistory(db, { limit: null }), [db]);
  const { data, error } = useFocusedLoad(load);
  // The filters chosen, kept while the app runs, and the one whose choices
  // are open in the sheet (null when it is closed).
  const [chosen, setChosen] = useState(NO_FILTER);
  const [picking, setPicking] = useState(null);
  // The rows the filters were last checked against. When fresh rows arrive, a
  // choice no row has any more (its last session was deleted) is forgotten,
  // so a later session there cannot bring the filter back by itself.
  const [checkedRows, setCheckedRows] = useState(null);
  if (data && data !== checkedRows) {
    setCheckedRows(data);
    setChosen(liveFilter(data, chosen));
  }

  if (error) return <ErrorText error={error} />;
  if (!data) return null;

  const { filter, rows, total, choices } = historyFilters(data, chosen);
  const filtered = isFiltered(filter);
  const shownKinds = FILTER_KINDS.filter((kind) => choices[kind].show);
  const months = historyByMonth(rows);
  // A car's name only tells the sessions apart when they are in several cars.
  const showVehicle = new Set(rows.map((row) => row.vehicle_id)).size > 1;
  const openMonth = (key) => router.navigate({ pathname: '/spending', params: { month: key, at: tapId() } });
  const choose = (value) => {
    setChosen({ ...filter, [picking]: value });
    setPicking(null);
  };

  return (
    <>
      <SectionList
        sections={months}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.container}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          shownKinds.length > 0 ? (
            <View style={styles.filters}>
              <View style={styles.pills}>
                {shownKinds.map((kind) => (
                  <FilterPill
                    key={kind}
                    label={filterPillText(kind, choices[kind].selected)}
                    accessibilityLabel={filterPillLabel(kind, choices[kind].selected)}
                    accessibilityHint="Opens the choices"
                    active={filter[kind] != null}
                    onPress={() => setPicking(kind)}
                  />
                ))}
              </View>
              {/* Within one month, its header already says this. */}
              {filtered && months.length > 1 && <Text style={styles.filteredTotal}>{totalLineText(total)}</Text>}
            </View>
          ) : null
        }
        ListEmptyComponent={
          // Choices follow each other, so only a session deleted since leaves a filtered list empty.
          filtered ? (
            <View style={styles.empty}>
              <Text style={styles.muted}>No parking matches these filters.</Text>
              <View style={styles.inlineAction}>
                <Button title="Clear filters" variant="tonal" size="small" onPress={() => setChosen(NO_FILTER)} />
              </View>
            </View>
          ) : (
            <Text style={styles.muted}>No finished parking yet.</Text>
          )
        }
        renderSectionHeader={({ section }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityHint="Opens this month on Spending"
            onPress={() => openMonth(section.key)}
            style={({ pressed }) => [
              styles.header,
              section !== months[0] && styles.laterHeader,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.month}>{formatMonth(section.key)}</Text>
            <Text style={styles.total}>{totalLineText(section)}</Text>
          </Pressable>
        )}
        renderItem={({ item, index, section }) => (
          // Only the newest month animates: the rest are below the first screenful.
          <Animated.View entering={section === months[0] ? enterUp(index) : undefined}>
            <SessionCard session={item} showVehicle={showVehicle} />
          </Animated.View>
        )}
      />
      <ChoiceSheet
        visible={picking != null}
        title={picking ? filterTitleText(picking) : ''}
        options={picking ? filterSheetOptions(picking, choices[picking]) : []}
        value={picking ? filter[picking] : null}
        onChange={choose}
        onClose={() => setPicking(null)}
      />
    </>
  );
}

const createStyles = (c) =>
  StyleSheet.create({
    container: { padding: 16, gap: 10 },
    filters: { gap: 8, paddingBottom: 4 },
    pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    filteredTotal: { color: c.muted, fontSize: 13, paddingHorizontal: 4 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      minHeight: 44,
      paddingHorizontal: 4,
    },
    // The list's gap plus this keeps months apart, as sections are.
    laterHeader: { marginTop: 12 },
    pressed: { opacity: 0.6 },
    month: { color: c.muted, fontSize: 12, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase' },
    total: { color: c.text, fontSize: 13, fontWeight: '600' },
    empty: { gap: 4 },
    // A row, so the small pill sits at the start instead of the centre.
    inlineAction: { flexDirection: 'row', marginTop: 8 },
    muted: { color: c.muted },
  });
