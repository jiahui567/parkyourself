import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { timerWouldEndText } from '../text/timerText';
import { Button } from './Button';
import { ErrorText } from './ErrorText';
import { radius } from './theme';
import { useThemedStyles } from './ThemeProvider';
import { TimerWheel } from './TimerWheel';

// A sheet from the bottom with the timer wheel, for setting one park's timer
// exactly (Find). initialMinutes is where the wheel starts; now (from the
// screen's clock) shows when the timer would end. onSet gets the minutes and
// may reject, which shows under the wheel; the caller closes the sheet. A tap
// above the sheet or Back closes it without setting anything, except while
// a timer is being set, so a failure is never missed.
// Mounted only while open, so the wheel starts fresh each time.
export function TimerSheet({ visible, initialMinutes, now, onSet, onClose }) {
  const [saving, setSaving] = useState(false);
  const close = () => {
    if (!saving) onClose();
  };
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={close}
      statusBarTranslucent
      navigationBarTranslucent
    >
      {visible && (
        <SheetBody
          initialMinutes={initialMinutes}
          now={now}
          onSet={onSet}
          onClose={close}
          saving={saving}
          setSaving={setSaving}
        />
      )}
    </Modal>
  );
}

function SheetBody({ initialMinutes, now, onSet, onClose, saving, setSaving }) {
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const [minutes, setMinutes] = useState(initialMinutes);
  const [error, setError] = useState(null);

  const set = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSet(minutes);
    } catch (e) {
      setError(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      {/* A tap above the sheet closes it, as on other Android sheets. */}
      <Pressable style={styles.fill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Cancel" />
      <View style={[styles.sheet, { paddingBottom: 16 + insets.bottom }]}>
        <Text style={styles.title} accessibilityRole="header">
          Set timer
        </Text>
        <TimerWheel value={minutes} onChange={setMinutes} />
        <Text style={styles.ends}>{timerWouldEndText(now, minutes)}</Text>
        <ErrorText error={error} />
        {/* The one main action; a tap above the sheet or Back cancels. */}
        <Button title={saving ? 'Setting…' : 'Set timer'} onPress={set} disabled={saving || minutes === 0} />
      </View>
    </View>
  );
}

const createStyles = (c) =>
  StyleSheet.create({
    screen: { flex: 1, justifyContent: 'flex-end', backgroundColor: c.backdropSoft },
    fill: { flex: 1 },
    sheet: {
      backgroundColor: c.card,
      borderTopLeftRadius: radius.card,
      borderTopRightRadius: radius.card,
      paddingTop: 20,
      paddingHorizontal: 16,
      gap: 12,
    },
    title: { fontSize: 17, fontWeight: '600', color: c.text, textAlign: 'center' },
    ends: { color: c.muted, textAlign: 'center' },
  });
