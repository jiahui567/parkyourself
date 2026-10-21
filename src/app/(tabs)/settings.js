import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ErrorText } from '../../components/ErrorText';
import { ChevronRightIcon } from '../../components/icons';
import { SegmentedControl } from '../../components/SegmentedControl';
import { radius } from '../../components/theme';
import { useAppTheme, useThemedStyles } from '../../components/ThemeProvider';

const MODE_OPTIONS = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
];

// Planned settings from PLAN.md, shown so the user can see what is coming.
const COMING_SOON = ['Places and rates', 'Reminders and timer', 'Public holidays', 'Export data'];

// Settings: appearance, cars, and what is coming next.
export default function Settings() {
  const { mode, setMode, loadError } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // One change at a time, so a failed save can never leave the screen and the
  // saved setting disagreeing.
  const changeMode = async (next) => {
    setSaving(true);
    setError(null);
    try {
      await setMode(next);
    } catch (e) {
      setError(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Section title="Appearance" styles={styles}>
        <View style={styles.padded}>
          <SegmentedControl options={MODE_OPTIONS} value={mode} onChange={changeMode} disabled={saving} />
          <ErrorText error={error ?? loadError} />
        </View>
      </Section>

      <Section title="Your cars" styles={styles}>
        <Row label="Cars" onPress={() => router.push('/vehicles')} styles={styles} />
      </Section>

      <Section title="Coming soon" styles={styles}>
        {COMING_SOON.map((label, index) => (
          <Row key={label} label={label} value="Soon" first={index === 0} styles={styles} />
        ))}
      </Section>

      {__DEV__ && (
        <Section title="Developer" styles={styles}>
          <Row label="Database check" onPress={() => router.push('/debug')} styles={styles} />
        </Section>
      )}

      <Text style={styles.footer}>
        Park Yourself {Constants.expoConfig?.version}
        {'\n'}Your data stays on this phone.
      </Text>
    </ScrollView>
  );
}

function Section({ title, styles, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

// A list row. Rows with onPress open a screen and show a chevron; rows
// without are read-only and show their value instead.
function Row({ label, value, onPress, first = true, styles }) {
  const { colours } = useAppTheme();
  const content = (
    <>
      <Text style={onPress ? styles.rowLabel : styles.rowLabelMuted}>{label}</Text>
      {value && <Text style={styles.rowValue}>{value}</Text>}
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
    container: { padding: 16, gap: 24 },
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
    padded: { padding: 12, gap: 8 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14, paddingHorizontal: 16, minHeight: 48 },
    rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    rowLabel: { flex: 1, fontSize: 16, color: c.text },
    rowLabelMuted: { flex: 1, fontSize: 16, color: c.muted },
    rowValue: { fontSize: 13, fontWeight: '600', color: c.muted },
    pressed: { backgroundColor: c.surface },
    footer: { color: c.muted, textAlign: 'center', fontSize: 13, lineHeight: 20 },
  });
