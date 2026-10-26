import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CheckIcon } from './icons';
import { radius } from './theme';
import { useAppTheme, useThemedStyles } from './ThemeProvider';

// A sheet from the bottom for one choice from a list that may be long
// (History's filters). options: [{ value, label, countText?,
// accessibilityLabel? }]; the one equal to value is checked. Tapping a row
// calls onChange(value), and the caller closes the sheet. A tap above the
// sheet or Back closes it with nothing changed.
export function ChoiceSheet({ visible, title, options, value, onChange, onClose }) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      {visible && <SheetBody title={title} options={options} value={value} onChange={onChange} onClose={onClose} />}
    </Modal>
  );
}

function SheetBody({ title, options, value, onChange, onClose }) {
  const { colours } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.screen}>
      {/* A tap above the sheet closes it, as on other Android sheets. */}
      <Pressable style={styles.fill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Cancel" />
      <View style={[styles.sheet, { paddingBottom: 8 + insets.bottom }]}>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        <FlatList
          data={options}
          keyExtractor={(option) => String(option.value)}
          style={styles.list}
          renderItem={({ item, index }) => {
            const checked = item.value === value;
            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked }}
                accessibilityLabel={item.accessibilityLabel ?? item.label}
                onPress={() => onChange(item.value)}
                style={({ pressed }) => [styles.row, index > 0 && styles.divider, pressed && styles.pressed]}
              >
                {/* Kept even when empty, so the labels line up. */}
                <View style={styles.check}>{checked && <CheckIcon size={18} color={colours.accent} />}</View>
                <Text style={checked ? styles.checkedLabel : styles.label} numberOfLines={1}>
                  {item.label}
                </Text>
                {item.countText != null && <Text style={styles.count}>{item.countText}</Text>}
              </Pressable>
            );
          }}
        />
      </View>
    </View>
  );
}

const createStyles = (c) =>
  StyleSheet.create({
    screen: { flex: 1, justifyContent: 'flex-end', backgroundColor: c.backdropSoft },
    fill: { flex: 1 },
    // A long list scrolls inside the sheet instead of covering the screen.
    sheet: {
      maxHeight: '75%',
      backgroundColor: c.card,
      borderTopLeftRadius: radius.card,
      borderTopRightRadius: radius.card,
      paddingTop: 20,
      paddingHorizontal: 16,
      gap: 8,
    },
    title: { fontSize: 17, fontWeight: '600', color: c.text, textAlign: 'center' },
    list: { flexGrow: 0 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, paddingVertical: 12 },
    divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    pressed: { opacity: 0.6 },
    check: { width: 18, alignItems: 'center' },
    label: { flex: 1, fontSize: 16, color: c.text },
    checkedLabel: { flex: 1, fontSize: 16, color: c.accent, fontWeight: '600' },
    count: { fontSize: 14, color: c.muted },
  });
