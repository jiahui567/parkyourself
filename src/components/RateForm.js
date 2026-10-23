import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { hasMoreRateOptions, moreRateOptionsInUse } from '../fees';
import { blockPriceLabel, firstPriceLabel, moreOptionsLabel } from '../text/rateText';
import { Button } from './Button';
import { Field } from './Field';
import { SegmentedControl } from './SegmentedControl';
import { space } from './theme';

const TYPE_OPTIONS = [
  { value: 'hourly', label: 'Hourly' },
  { value: 'flat', label: 'Flat' },
];

// Edits one rate as typed: value is a RateFormValue (all strings, see
// src/fees/rateForm.js) and onChange gets the whole new value. Checking it is
// the screen's job (rateFromForm), and the screen shows the error, so this
// form shows none. Switching type keeps the other type's fields, so switching
// back loses nothing.
// Most car parks charge by the hour, which the form is prefilled with, so it
// shows only the prices; the period lengths, free minutes and daily max wait
// under "More options", which starts open when the rate already uses them.
// "Fewer options" folds them away again, keeping what was typed; the
// folded button then says how many are set.
export function RateForm({ value, onChange, disabled = false }) {
  const [more, setMore] = useState(() => hasMoreRateOptions(value));
  const set = (key) => (text) => onChange({ ...value, [key]: text });
  const input = (key, keyboardType) => ({
    value: value[key],
    onChangeText: set(key),
    keyboardType,
    editable: !disabled,
  });
  const minutes = (key) => input(key, 'number-pad');
  const price = (key) => input(key, 'decimal-pad');
  const flat = value.type === 'flat';

  return (
    <View style={styles.form}>
      <SegmentedControl options={TYPE_OPTIONS} value={value.type} onChange={set('type')} disabled={disabled} />
      {flat ? (
        <View style={styles.pair}>
          <View style={styles.half}>
            <Field label="Price per entry (RM)" placeholder="e.g. 5.00" {...price('flatPrice')} />
          </View>
          <View style={styles.half}>{more && <Field label="Free minutes" {...minutes('graceMinutes')} />}</View>
        </View>
      ) : (
        <View style={styles.pair}>
          <View style={styles.half}>
            <Field label={firstPriceLabel(value.firstMinutes)} placeholder="e.g. 3.00" {...price('firstPrice')} />
          </View>
          <View style={styles.half}>
            <Field label={blockPriceLabel(value.blockMinutes)} placeholder="e.g. 2.00" {...price('blockPrice')} />
          </View>
        </View>
      )}
      {more && !flat && (
        <>
          <View style={styles.pair}>
            <View style={styles.half}>
              <Field label="First period (min)" {...minutes('firstMinutes')} />
            </View>
            <View style={styles.half}>
              <Field label="Each period after (min)" {...minutes('blockMinutes')} />
            </View>
          </View>
          <View style={styles.pair}>
            <View style={styles.half}>
              <Field label="Free minutes" {...minutes('graceMinutes')} />
            </View>
            <View style={styles.half}>
              <Field label="Daily max (RM)" placeholder="Optional" {...price('dailyCap')} />
            </View>
          </View>
        </>
      )}
      <View style={styles.sideActions}>
        <Button
          title={moreOptionsLabel(more, moreRateOptionsInUse(value))}
          variant="secondary"
          size="small"
          onPress={() => setMore((current) => !current)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: space },
  // flex-end keeps the two inputs level when a long label wraps (large fonts).
  pair: { flexDirection: 'row', alignItems: 'flex-end', gap: space },
  half: { flex: 1 },
  // A row, so the small pill sits at the start instead of the centre.
  sideActions: { flexDirection: 'row' },
});
