import { StyleSheet, Text, View } from 'react-native';

import { radius } from './theme';
import { useThemedStyles } from './ThemeProvider';

// The amber pill beside a fee that may differ from the receipt: a stay past
// midnight, or one that borrowed another day type's rate. Never emerald.
export function EstimatePill() {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.pill}>
      <Text style={styles.text}>Estimate</Text>
    </View>
  );
}

const createStyles = (c) =>
  StyleSheet.create({
    pill: { backgroundColor: c.warningSoft, borderRadius: radius.pill, paddingVertical: 3, paddingHorizontal: 10 },
    text: { color: c.warning, fontSize: 12, fontWeight: '700' },
  });
