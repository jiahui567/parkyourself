import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DEFAULT_THEME_MODE, palettes, radius, space } from './theme';

// What the app shows instead of itself when a screen or the root layout
// throws while drawing (the root layout's ErrorBoundary), such as when the
// database cannot be opened or brought up to date at start: without it a
// release build closes, at every start in that case, and the reason is never
// seen. The theme choice is kept in that database, so this is drawn outside
// AppThemeProvider, in the default mode, with the large primary Button's
// look. retry draws the app again, opening the database anew.
export function AppError({ error, retry }) {
  return (
    <View style={styles.screen}>
      <StatusBar style={c.statusBar} />
      <Text accessibilityRole="header" style={styles.title}>
        Something went wrong
      </Text>
      <Text accessibilityRole="alert" style={styles.message}>
        {String(error?.message ?? error)}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={retry}
        style={({ pressed }) => [styles.button, pressed && styles.dimmed]}
      >
        <Text style={styles.buttonText}>Try again</Text>
      </Pressable>
    </View>
  );
}

const c = palettes[DEFAULT_THEME_MODE];

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', gap: space, padding: 24, backgroundColor: c.background },
  title: { fontSize: 18, fontWeight: '600', color: c.text },
  message: { color: c.muted },
  button: {
    alignItems: 'center',
    marginTop: space,
    borderRadius: radius.control,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: c.primary,
  },
  dimmed: { opacity: 0.6 },
  buttonText: { fontSize: 16, fontWeight: '600', color: c.onPrimary },
});
