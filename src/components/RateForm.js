import { StyleSheet, View } from 'react-native';

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
export function RateForm({ value, onChange, disabled = false }) {
  const set = (key) => (text) => onChange({ ...value, [key]: text });
  const input = (key, keyboardType) => ({
    value: value[key],
    onChangeText: set(key),
    keyboardType,
    editable: !disabled,
  });
  const minutes = (key) => input(key, 'number-pad');
  const price = (key) => input(key, 'decimal-pad');

  return (
    <View style={styles.form}>
      <SegmentedControl options={TYPE_OPTIONS} value={value.type} onChange={set('type')} disabled={disabled} />
      {value.type === 'flat' ? (
        <View style={styles.pair}>
          <View style={styles.half}>
            <Field label="Price per entry (RM)" placeholder="0.00" {...price('flatPrice')} />
          </View>
          <View style={styles.half}>
            <Field label="Free minutes" {...minutes('graceMinutes')} />
          </View>
        </View>
      ) : (
        <>
          <View style={styles.pair}>
            <View style={styles.half}>
              <Field label="First period (min)" {...minutes('firstMinutes')} />
            </View>
            <View style={styles.half}>
              <Field label="First price (RM)" placeholder="0.00" {...price('firstPrice')} />
            </View>
          </View>
          <View style={styles.pair}>
            <View style={styles.half}>
              <Field label="Each block (min)" {...minutes('blockMinutes')} />
            </View>
            <View style={styles.half}>
              <Field label="Block price (RM)" placeholder="0.00" {...price('blockPrice')} />
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
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: space },
  // flex-end keeps the two inputs level when a long label wraps (large fonts).
  pair: { flexDirection: 'row', alignItems: 'flex-end', gap: space },
  half: { flex: 1 },
});
