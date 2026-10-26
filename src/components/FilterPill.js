import { Pressable, StyleSheet, Text } from 'react-native';

import { ChevronDownIcon } from './icons';
import { radius } from './theme';
import { useAppTheme, useThemedStyles } from './ThemeProvider';

// A filter's value as a pill that opens its choices (History's filters). active
// (a choice made) shows it like a selected chip, emerald on soft emerald.
export function FilterPill({ label, active, onPress, accessibilityLabel, accessibilityHint }) {
  const { colours } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [styles.pill, active && styles.active, pressed && styles.pressed]}
    >
      <Text style={active ? styles.activeText : styles.text} numberOfLines={1}>
        {label}
      </Text>
      <ChevronDownIcon size={16} color={active ? colours.accent : colours.muted} />
    </Pressable>
  );
}

const createStyles = (c) =>
  StyleSheet.create({
    // As ChipGroup's chips, so a set filter reads like a picked chip.
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      maxWidth: '100%',
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      borderRadius: radius.pill,
      paddingVertical: 8,
      paddingLeft: 14,
      paddingRight: 10,
    },
    active: { borderColor: c.accent, backgroundColor: c.accentSoft },
    pressed: { opacity: 0.7 },
    text: { flexShrink: 1, color: c.text },
    activeText: { flexShrink: 1, color: c.accent, fontWeight: '600' },
  });
