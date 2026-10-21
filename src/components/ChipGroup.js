import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colours } from './theme';

// One choice from a row of chips. Tapping the selected chip clears the choice.
// options: [{ value, label, swatch? }]
export function ChipGroup({ options, value, onChange }) {
  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
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

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colours.border,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  selected: { borderColor: colours.primary, backgroundColor: '#E8EEFB' },
  swatch: { width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: colours.border },
  text: { color: colours.text },
  selectedText: { color: colours.primary, fontWeight: '600' },
});
