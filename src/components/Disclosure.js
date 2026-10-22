import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ChevronDownIcon } from './icons';
import { useAppTheme, useThemedStyles } from './ThemeProvider';

const ICON_SIZE = 18;

// A card row that opens to show what is under it, so an optional part of a
// form (Park's rate, timer and note, Find's way back) stays one line until
// the user asks for it. The screen keeps open, so it can open the row itself,
// such as for an error inside. value is a short word at the end ('Off',
// '2 hours'); hint is a muted line under the label (the rate, the route).
// Like ListRow, every row but the first draws a hairline above itself; put
// the rows in a card with overflow hidden.
export function Disclosure({ label, value, hint, icon: Icon, open, onToggle, first = true, children }) {
  const { colours } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={!first && styles.divider}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={onToggle}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        {Icon && <Icon size={ICON_SIZE} color={colours.muted} />}
        <View style={styles.text}>
          <Text style={styles.label}>{label}</Text>
          {hint ? (
            <Text style={styles.hint} numberOfLines={open ? undefined : 2}>
              {hint}
            </Text>
          ) : null}
        </View>
        {value != null && <Text style={styles.value}>{value}</Text>}
        <View style={open && styles.flipped}>
          <ChevronDownIcon size={ICON_SIZE} color={colours.muted} />
        </View>
      </Pressable>
      {open && <View style={styles.body}>{children}</View>}
    </View>
  );
}

const createStyles = (c) =>
  StyleSheet.create({
    divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, minHeight: 48 },
    pressed: { backgroundColor: c.surface },
    text: { flex: 1, gap: 2 },
    label: { fontSize: 16, color: c.text },
    hint: { fontSize: 13, color: c.muted },
    value: { fontSize: 13, fontWeight: '600', color: c.muted },
    flipped: { transform: [{ rotate: '180deg' }] },
    body: { paddingHorizontal: 16, paddingBottom: 16, gap: 10 },
  });
