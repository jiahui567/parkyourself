import { Pressable, StyleSheet } from 'react-native';

import { radius } from './theme';
import { useAppTheme, useThemedStyles } from './ThemeProvider';

const SIZE = 44;

// A round icon-only button over the camera or a full-screen photo, where the
// theme's own buttons would not show up. label is read by screen readers.
export function BackdropButton({ icon: Icon, label, onPress, disabled = false }) {
  const { colours } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.button, (pressed || disabled) && styles.dimmed]}
    >
      <Icon size={22} color={colours.onBackdrop} />
    </Pressable>
  );
}

const createStyles = (c) =>
  StyleSheet.create({
    button: {
      width: SIZE,
      height: SIZE,
      borderRadius: radius.pill,
      backgroundColor: c.backdropSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dimmed: { opacity: 0.6 },
  });
