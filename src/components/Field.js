import { StyleSheet, Text, TextInput, View } from 'react-native';

import { radius } from './theme';
import { useAppTheme, useThemedStyles } from './ThemeProvider';

// A labelled text input. Other props go to TextInput. Without a label (a
// field under a row that already names it), pass accessibilityLabel.
export function Field({ label, ...inputProps }) {
  const { colours } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.field}>
      {label != null && <Text style={styles.label}>{label}</Text>}
      <TextInput
        style={[styles.input, inputProps.multiline && styles.multiline]}
        placeholderTextColor={colours.muted}
        selectionColor={colours.accent}
        {...inputProps}
      />
    </View>
  );
}

const createStyles = (c) =>
  StyleSheet.create({
    field: { gap: 6 },
    label: { fontWeight: '600', color: c.text },
    input: {
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      borderRadius: radius.control,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      color: c.text,
    },
    multiline: { minHeight: 80, textAlignVertical: 'top' },
  });
