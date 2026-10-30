import { Stack } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '../components/Button';
import { useDialog } from '../components/Dialog';
import { ErrorText } from '../components/ErrorText';
import { Field } from '../components/Field';
import { IconButton } from '../components/IconButton';
import { PlusIcon, TrashIcon } from '../components/icons';
import { radius, space } from '../components/theme';
import { useThemedStyles } from '../components/ThemeProvider';
import { holidays, useDatabase } from '../db';
import { useFocusedLoad } from '../hooks/useFocusedLoad';
import { MAX_LENGTH } from '../lib/textLimits';
import { formatDateKey, localDateKey } from '../lib/time';

// Public holidays: the user's own list of dates (no internet calendar), typed
// as YYYY-MM-DD (PLAN.md, "Saved places and rates"). Park can add today to it too.
export default function Holidays() {
  const db = useDatabase();
  const styles = useThemedStyles(createStyles);
  const showDialog = useDialog();
  const load = useCallback(() => holidays.list(db), [db]);
  const { data: rows, error: loadError, reload } = useFocusedLoad(load);
  const [date, setDate] = useState('');
  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);
  const [actionError, setActionError] = useState(null);

  const add = async () => {
    setAdding(true);
    setActionError(null);
    try {
      await holidays.addInTransaction(db, { holiday_date: date, name });
      setDate('');
      setName('');
      reload();
    } catch (e) {
      setActionError(e);
    } finally {
      setAdding(false);
    }
  };

  const remove = async (holiday) => {
    setActionError(null);
    try {
      await holidays.remove(db, holiday.id);
      reload();
    } catch (e) {
      setActionError(e);
    }
  };

  const confirmRemove = (holiday) =>
    showDialog({
      title: `Delete ${formatDateKey(holiday.holiday_date)}?`,
      message: 'Parking on this day uses the weekday or weekend rate again. Fees already saved do not change.',
      buttons: [
        { text: 'Delete', style: 'destructive', onPress: () => remove(holiday) },
        { text: 'Cancel', style: 'cancel' },
      ],
    });

  if (loadError) return <ErrorText error={loadError} />;
  if (!rows) return null;

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: 'Public holidays' }} />
      <Text style={styles.intro}>
        On these dates, parking costs the place&apos;s public holiday amount, or its weekend rate if it has none.
      </Text>

      <View style={styles.card}>
        <View style={styles.dateRow}>
          <View style={styles.dateField}>
            <Field
              label="Date"
              value={date}
              onChangeText={setDate}
              placeholder="e.g. 2026-12-25"
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={10}
              editable={!adding}
            />
          </View>
          {/* As tall as the input, so the pill sits level with it. */}
          <View style={styles.todaySlot}>
            <Button
              title="Today"
              variant="secondary"
              size="small"
              onPress={() => setDate(localDateKey(Date.now()))}
              disabled={adding}
            />
          </View>
        </View>
        <Field
          label="Name (optional)"
          value={name}
          onChangeText={setName}
          placeholder="e.g. Christmas"
          maxLength={MAX_LENGTH.public_holiday.name}
          editable={!adding}
        />
        <Button
          title={adding ? 'Saving…' : 'Add'}
          variant="tonal"
          size="small"
          icon={PlusIcon}
          onPress={add}
          disabled={adding}
        />
      </View>
      <ErrorText error={actionError} />

      {rows.length === 0 ? (
        <Text style={styles.empty}>
          No public holidays yet. Add one above.
        </Text>
      ) : (
        <View style={styles.listCard}>
          {rows.map((holiday, index) => {
            const dateText = formatDateKey(holiday.holiday_date);
            return (
              <View key={holiday.id} style={[styles.row, index > 0 && styles.divider]}>
                <View style={styles.rowText}>
                  <Text style={styles.date}>{dateText}</Text>
                  {holiday.name ? <Text style={styles.name}>{holiday.name}</Text> : null}
                </View>
                <IconButton
                  icon={TrashIcon}
                  label={`Delete ${dateText}`}
                  tone="danger"
                  onPress={() => confirmRemove(holiday)}
                />
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const createStyles = (c) =>
  StyleSheet.create({
    container: { padding: 16, gap: space },
    intro: { color: c.muted, lineHeight: 20 },
    card: { backgroundColor: c.card, borderRadius: radius.card, padding: 16, gap: space, boxShadow: c.shadow },
    // flex-end keeps the pill level with the input when the label wraps (large fonts).
    dateRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space },
    dateField: { flex: 1 },
    todaySlot: { minHeight: 48, justifyContent: 'center' },
    listCard: { backgroundColor: c.card, borderRadius: radius.card, overflow: 'hidden', boxShadow: c.shadow },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingLeft: 16, paddingRight: 12 },
    divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    rowText: { flex: 1, gap: 2 },
    date: { fontSize: 16, fontWeight: '600', color: c.text },
    name: { fontSize: 13, color: c.muted },
    empty: { color: c.muted, lineHeight: 20 },
  });
