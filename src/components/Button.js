import { Pressable, StyleSheet, Text } from 'react-native';

import { colours } from './theme';

// variant: 'primary' (filled), 'secondary' (outlined) or 'danger' (outlined red).
export function Button({ title, onPress, variant = 'primary', disabled = false }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.base, styles[variant], (pressed || disabled) && styles.dimmed]}
    >
      <Text style={[styles.text, styles[`${variant}Text`]]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: 8, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center', borderWidth: 1 },
  primary: { backgroundColor: colours.primary, borderColor: colours.primary },
  secondary: { backgroundColor: colours.background, borderColor: colours.primary },
  danger: { backgroundColor: colours.background, borderColor: colours.danger },
  dimmed: { opacity: 0.6 },
  text: { fontWeight: '600', fontSize: 16 },
  primaryText: { color: '#FFFFFF' },
  secondaryText: { color: colours.primary },
  dangerText: { color: colours.danger },
});
