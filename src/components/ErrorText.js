import { StyleSheet, Text } from 'react-native';

import { colours } from './theme';

// Shows an error's message, or nothing when there is no error.
export function ErrorText({ error }) {
  if (!error) return null;
  return (
    <Text accessibilityRole="alert" style={styles.error}>
      {String(error?.message ?? error)}
    </Text>
  );
}

const styles = StyleSheet.create({
  error: { color: colours.danger, padding: 4 },
});
