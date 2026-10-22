import { Pressable, StyleSheet, Text, View } from 'react-native';

import { radius } from './theme';
import { useThemedStyles } from './ThemeProvider';

// One choice from a row of chips. Tapping the selected chip clears the choice.
// options: [{ value, label, swatch?, accessibilityLabel? }]; give
// accessibilityLabel when a row label outside the chips says what they are
// ('Level G3' for a chip reading 'G3').
export function ChipGroup({ options, value, onChange }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={option.accessibilityLabel}
            accessibilityState={{ selected }}
            onPress={() => onChange(selected ? null : option.value)}
            style={[styles.chip, selected && styles.selected]}
          >
            {option.swatch && <View style={[styles.swatch, { backgroundColor: option.swatch }]} />}
            <Text style={selected ? styles.selectedText : styles.text}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const createStyles = (c) =>
  StyleSheet.create({
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      borderRadius: radius.pill,
      paddingVertical: 8,
      paddingHorizontal: 14,
    },
    selected: { borderColor: c.accent, backgroundColor: c.accentSoft },
    swatch: { width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: c.border },
    text: { color: c.text },
    selectedText: { color: c.accent, fontWeight: '600' },
  });
