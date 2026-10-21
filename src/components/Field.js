import { StyleSheet, Text, TextInput, View } from 'react-native';

import { colours } from './theme';

// A labelled text input. Other props go to TextInput.
export function Field({ label, ...inputProps }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, inputProps.multiline && styles.multiline]}
        placeholderTextColor={colours.muted}
        {...inputProps}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 4 },
  label: { fontWeight: '600', color: colours.text },
  input: {
    borderWidth: 1,
    borderColor: colours.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colours.text,
  },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
});
