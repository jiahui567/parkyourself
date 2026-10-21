import { Pressable, StyleSheet } from 'react-native';

import { radius } from './theme';
import { useAppTheme, useThemedStyles } from './ThemeProvider';

const SIZE = 36;
// Grows the touch area to 48 px without making the circle bigger.
const HIT_SLOP = (48 - SIZE) / 2;

// A round icon-only button. label is read by screen readers, so say what it
// does ("Archive My Myvi"). tone 'danger' draws the icon in red.
export function IconButton({ icon: Icon, label, onPress, tone = 'neutral', disabled = false }) {
  const { colours } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      hitSlop={HIT_SLOP}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.button, (pressed || disabled) && styles.dimmed]}
    >
      <Icon size={18} color={tone === 'danger' ? colours.danger : colours.muted} />
    </Pressable>
  );
}

const createStyles = (c) =>
  StyleSheet.create({
    button: {
      width: SIZE,
      height: SIZE,
      borderRadius: radius.pill,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dimmed: { opacity: 0.6 },
  });
