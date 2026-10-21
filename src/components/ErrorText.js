import { StyleSheet, Text } from 'react-native';

import { useThemedStyles } from './ThemeProvider';

// Shows an error's message, or nothing when there is no error.
export function ErrorText({ error }) {
  const styles = useThemedStyles(createStyles);
  if (!error) return null;
  return (
    <Text accessibilityRole="alert" style={styles.error}>
      {String(error?.message ?? error)}
    </Text>
  );
}

const createStyles = (c) =>
  StyleSheet.create({
    error: { color: c.danger, padding: 4 },
  });
