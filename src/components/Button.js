import { Pressable, StyleSheet, Text } from 'react-native';

import { radius } from './theme';
import { useAppTheme, useThemedStyles } from './ThemeProvider';

// The colour token for the title and icon of each variant.
const CONTENT_COLOUR = { primary: 'onPrimary', secondary: 'text', tonal: 'accent', danger: 'danger' };

// variant: 'primary' (filled emerald), 'secondary' (filled grey), 'tonal'
// (soft emerald) or 'danger' (outlined red).
// size: 'large' fills the width, for a screen's one main action; 'small' is a
// pill sized to its label, for side actions in lists.
// icon: an icon component from icons.js, drawn before the title.
export function Button({ title, onPress, variant = 'primary', size = 'large', icon: Icon, disabled = false }) {
  const { colours } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const contentColour = colours[CONTENT_COLOUR[variant]];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.base, styles[size], styles[variant], (pressed || disabled) && styles.dimmed]}
    >
      {Icon && <Icon size={size === 'small' ? 16 : 20} color={contentColour} />}
      <Text style={[styles.text, styles[`${size}Text`], { color: contentColour }]}>{title}</Text>
    </Pressable>
  );
}

const createStyles = (c) =>
  StyleSheet.create({
    base: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1 },
    large: { borderRadius: radius.control, paddingVertical: 14, paddingHorizontal: 16 },
    small: { alignSelf: 'center', borderRadius: radius.pill, paddingVertical: 7, paddingHorizontal: 14 },
    primary: { backgroundColor: c.primary, borderColor: c.primary },
    secondary: { backgroundColor: c.surface, borderColor: c.surface },
    tonal: { backgroundColor: c.accentSoft, borderColor: c.accentSoft },
    danger: { backgroundColor: 'transparent', borderColor: c.danger },
    dimmed: { opacity: 0.6 },
    text: { fontWeight: '600' },
    largeText: { fontSize: 16 },
    smallText: { fontSize: 14 },
  });
