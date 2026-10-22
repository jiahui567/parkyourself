import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useOnAppActive } from '../hooks/useOnAppActive';
import { BackdropButton } from './BackdropButton';
import { Button } from './Button';
import { XIcon } from './icons';
import { radius } from './theme';
import { useThemedStyles } from './ThemeProvider';

const SHUTTER = 72;

// A full-screen camera that takes one photo. onCapture gets the picture
// ({ uri, width, height }, a temporary file); the caller closes the camera.
// Only one camera preview can run at a time, so it is mounted only while open.
export function CameraCapture({ visible, onCapture, onClose }) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      {visible && <CameraBody onCapture={onCapture} onClose={onClose} />}
    </Modal>
  );
}

function CameraBody({ onCapture, onClose }) {
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const camera = useRef(null);
  const [permission, requestPermission, getPermission] = useCameraPermissions();
  // Coming back from Android settings, where the user may have allowed it.
  useOnAppActive(getPermission);
  const [ready, setReady] = useState(false);
  const [taking, setTaking] = useState(false);
  const [error, setError] = useState(null);

  const take = async () => {
    setTaking(true);
    setError(null);
    try {
      onCapture(await camera.current.takePictureAsync({ quality: 0.9 }));
    } catch (e) {
      setError(e);
      setTaking(false);
    }
  };

  const closeButton = (
    <View style={[styles.top, { paddingTop: insets.top + 12 }]}>
      <BackdropButton icon={XIcon} label="Close camera" onPress={onClose} />
    </View>
  );

  // Still asking Android whether the app may use the camera.
  if (!permission) return <View style={styles.screen}>{closeButton}</View>;

  if (!permission.granted) {
    return (
      <View style={styles.screen}>
        {closeButton}
        <View style={styles.ask}>
          <Text style={styles.text}>Park Yourself needs the camera to photograph the pillar sign.</Text>
          {permission.canAskAgain ? (
            <Button title="Allow camera" onPress={requestPermission} />
          ) : (
            // Android stops asking after the user said no twice; only Settings can allow it then.
            <Button title="Open settings" onPress={() => Linking.openSettings()} />
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" onCameraReady={() => setReady(true)} />
      {closeButton}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 24 }]}>
        {/* Not ErrorText: its danger red is hard to read on the black backdrop. */}
        {error && <Text style={styles.text}>{String(error?.message ?? error)}</Text>}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Take photo"
          accessibilityState={{ disabled: !ready || taking }}
          onPress={take}
          disabled={!ready || taking}
          style={({ pressed }) => [styles.shutter, (pressed || !ready || taking) && styles.dimmed]}
        >
          <View style={styles.shutterInner} />
        </Pressable>
      </View>
    </View>
  );
}

const createStyles = (c) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.backdrop },
    top: { position: 'absolute', top: 0, left: 16 },
    bottom: { position: 'absolute', bottom: 0, left: 16, right: 16, alignItems: 'center', gap: 12 },
    ask: { flex: 1, justifyContent: 'center', padding: 24, gap: 16 },
    text: { color: c.onBackdrop, textAlign: 'center', lineHeight: 22 },
    shutter: {
      width: SHUTTER,
      height: SHUTTER,
      borderRadius: radius.pill,
      borderWidth: 4,
      borderColor: c.onBackdrop,
      alignItems: 'center',
      justifyContent: 'center',
    },
    shutterInner: {
      width: SHUTTER - 16,
      height: SHUTTER - 16,
      borderRadius: radius.pill,
      backgroundColor: c.onBackdrop,
    },
    dimmed: { opacity: 0.5 },
  });
