import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { useAppTheme, useThemedStyles } from './ThemeProvider';

// A label (and an optional muted hint) with an on/off switch at the end. The
// whole row toggles, so the touch target is the row, not the small switch. It
// adds no side padding: inside a card, wrap it in a padded View.
export function SwitchRow({ label, hint, value, onValueChange, disabled = false }) {
  const { colours } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      style={styles.row}
    >
      <View style={styles.text}>
        <Text style={styles.label}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        // The soft track keeps the solid thumb visible on it in both modes.
        trackColor={{ false: colours.border, true: colours.accentSoft }}
        thumbColor={value ? colours.accent : colours.muted}
        // The row already speaks for the switch; hide it so a screen reader
        // does not stop on it twice.
        accessible={false}
        importantForAccessibility="no"
        style={disabled && styles.dimmed}
      />
    </Pressable>
  );
}

const createStyles = (c) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, minHeight: 48 },
    text: { flex: 1, gap: 2 },
    label: { fontWeight: '600', color: c.text },
    hint: { fontSize: 13, color: c.muted },
    dimmed: { opacity: 0.6 },
  });
