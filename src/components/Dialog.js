import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { acceptsTap, dialogButtons, dismissButton, queueDialog, unqueueDialog } from '../lib/dialog';
import { Button } from './Button';
import { radius } from './theme';
import { useThemedStyles } from './ThemeProvider';

// The app's own dialog: a question or message in a sheet from the bottom,
// drawn in the theme, instead of Android's Alert, which looked unrelated to
// the app (2026-10-26). DialogProvider goes once in the root layout; screens
// and hooks call
//   const showDialog = useDialog();
//   showDialog({ title, message, buttons: [{ text, style, onPress }] });
// with the buttons top to bottom (src/lib/dialog.js has the rules). A dialog
// asked for while another shows waits its turn.

const DialogContext = createContext(null);

// Only the sheet's effect and its button handler read the clock; the React
// Compiler lint cannot tell the handler from render code, so the read lives
// out here, as on Find.
const clockNow = () => Date.now();

export function DialogProvider({ children }) {
  const [queue, setQueue] = useState([]);
  // The dialog being closed, so a second tap before the sheet goes cannot
  // run a button twice or close the next dialog.
  const closing = useRef(null);
  // Numbers each dialog, so the sheet's content mounts afresh for the next one.
  const lastId = useRef(0);

  const showDialog = useCallback((dialog) => {
    const id = ++lastId.current;
    setQueue((current) => queueDialog(current, { ...dialog, id }));
  }, []);

  const close = (dialog, button) => {
    if (closing.current === dialog) return;
    closing.current = dialog;
    setQueue((current) => unqueueDialog(current, dialog));
    button?.onPress?.();
  };

  const current = queue[0] ?? null;
  return (
    <DialogContext.Provider value={showDialog}>
      {children}
      <Modal
        visible={current != null}
        transparent
        animationType="slide"
        onRequestClose={() => current && close(current, dismissButton(current.buttons))}
        statusBarTranslucent
        navigationBarTranslucent
      >
        {current && <SheetBody key={current.id} dialog={current} onClose={close} />}
      </Modal>
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const showDialog = useContext(DialogContext);
  if (!showDialog) throw new Error('useDialog must be used inside DialogProvider.');
  return showDialog;
}

// Mounted once per dialog (keyed by its id), so shownAt is when this one appeared.
function SheetBody({ dialog, onClose }) {
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const shownAt = useRef(0);
  useEffect(() => {
    shownAt.current = clockNow();
  }, []);
  const press = (button) => {
    if (acceptsTap(shownAt.current, clockNow())) onClose(dialog, button);
  };
  return (
    <View style={styles.screen}>
      {/* A tap above the sheet closes it, as on the app's other sheets. */}
      <Pressable
        style={styles.fill}
        onPress={() => onClose(dialog, dismissButton(dialog.buttons))}
        accessibilityRole="button"
        accessibilityLabel="Cancel"
      />
      <View style={[styles.sheet, { paddingBottom: 16 + insets.bottom }]}>
        <View style={styles.text}>
          <Text style={styles.title} accessibilityRole="header">
            {dialog.title}
          </Text>
          {dialog.message ? <Text style={styles.message}>{dialog.message}</Text> : null}
        </View>
        <View style={styles.buttons}>
          {dialogButtons(dialog.buttons).map((button) => (
            <Button
              key={button.text}
              title={button.text}
              variant={button.variant}
              onPress={() => press(button)}
            />
          ))}
        </View>
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
      paddingTop: 24,
      paddingHorizontal: 16,
      gap: 20,
    },
    text: { gap: 8, paddingHorizontal: 8 },
    title: { fontSize: 17, fontWeight: '600', color: c.text, textAlign: 'center' },
    message: { fontSize: 15, lineHeight: 22, color: c.muted, textAlign: 'center' },
    buttons: { gap: 8 },
  });
