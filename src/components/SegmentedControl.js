import { Pressable, StyleSheet, Text, View } from 'react-native';

import { radius } from './theme';
import { useThemedStyles } from './ThemeProvider';

// One of two to four options, always one selected (unlike ChipGroup, which
// can be cleared). options: [{ value, label }]
export function SegmentedControl({ options, value, onChange, disabled = false }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.track} accessibilityRole="radiogroup">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled }}
            disabled={disabled}
            onPress={() => !selected && onChange(option.value)}
            style={[styles.segment, selected && styles.selected]}
          >
            <Text style={selected ? styles.selectedText : styles.text}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const createStyles = (c) =>
  StyleSheet.create({
    track: { flexDirection: 'row', backgroundColor: c.surface, borderRadius: radius.control, padding: 4, gap: 4 },
    segment: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.control - 4 },
    selected: { backgroundColor: c.card, boxShadow: c.shadow },
    text: { color: c.muted, fontWeight: '600' },
    selectedText: { color: c.text, fontWeight: '600' },
  });
