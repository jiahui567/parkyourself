import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ChevronRightIcon } from './icons';
import { radius } from './theme';
import { useAppTheme, useThemedStyles } from './ThemeProvider';

// A titled card of rows, as on Settings. Put ListRows inside, the first with
// first (the default) and the rest with first={false}.
export function ListSection({ title, children }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

// A list row. Rows with onPress open a screen and show a chevron; rows
// without are read-only, so their label is muted and they show their value.
// Every row but the first draws a hairline above itself.
export function ListRow({ label, value, onPress, first = true }) {
  const { colours } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const content = (
    <>
      <Text style={onPress ? styles.rowLabel : styles.rowLabelMuted}>{label}</Text>
      {/* A number such as 0 must not reach the View as bare text. */}
      {value != null && <Text style={styles.rowValue}>{value}</Text>}
      {onPress && <ChevronRightIcon size={18} color={colours.muted} />}
    </>
  );
  const rowStyle = [styles.row, !first && styles.rowDivider];
  if (!onPress) return <View style={rowStyle}>{content}</View>;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [rowStyle, pressed && styles.pressed]}>
      {content}
    </Pressable>
  );
}

const createStyles = (c) =>
  StyleSheet.create({
    section: { gap: 8 },
    sectionTitle: {
      color: c.muted,
      fontSize: 12,
      fontWeight: '600',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      paddingHorizontal: 4,
    },
    card: { backgroundColor: c.card, borderRadius: radius.card, overflow: 'hidden', boxShadow: c.shadow },
    row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14, paddingHorizontal: 16, minHeight: 48 },
    rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    rowLabel: { flex: 1, fontSize: 16, color: c.text },
    rowLabelMuted: { flex: 1, fontSize: 16, color: c.muted },
    rowValue: { fontSize: 13, fontWeight: '600', color: c.muted },
    pressed: { backgroundColor: c.surface },
  });
