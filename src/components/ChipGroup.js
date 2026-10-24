import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';

import { radius } from './theme';
import { useThemedStyles } from './ThemeProvider';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const POP_SPRING = { damping: 12, stiffness: 260 };
const POP_IN_STAGGER_MS = 60;

// One choice from a row of chips. Tapping the selected chip clears the choice.
// options: [{ value, label, swatch?, accessibilityLabel? }]; give
// accessibilityLabel when a row label outside the chips says what they are
// ('Level G3' for a chip reading 'G3'). A chip gives a small pop when it
// becomes selected; popIn also pops each chip in as it appears (codes read
// from a photo).
export function ChipGroup({ options, value, onChange, popIn = false }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {options.map((option, index) => (
        <Animated.View
          key={option.value}
          entering={popIn ? ZoomIn.springify().damping(14).delay(index * POP_IN_STAGGER_MS) : undefined}
        >
          <Chip option={option} selected={option.value === value} onChange={onChange} styles={styles} />
        </Animated.View>
      ))}
    </View>
  );
}

function Chip({ option, selected, onChange, styles }) {
  const scale = useSharedValue(1);
  const wasSelected = useRef(selected);
  useEffect(() => {
    if (selected && !wasSelected.current) {
      scale.set(withSequence(withTiming(1.08, { duration: 90 }), withSpring(1, POP_SPRING)));
    }
    wasSelected.current = selected;
  }, [selected, scale]);
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return (
    <AnimatedPressable
      accessibilityRole="radio"
      accessibilityLabel={option.accessibilityLabel}
      accessibilityState={{ selected }}
      onPress={() => onChange(selected ? null : option.value)}
      style={[styles.chip, selected && styles.selected, popStyle]}
    >
      {option.swatch && <View style={[styles.swatch, { backgroundColor: option.swatch }]} />}
      <Text style={selected ? styles.selectedText : styles.text}>{option.label}</Text>
    </AnimatedPressable>
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
