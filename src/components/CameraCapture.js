import { CameraView, useCameraPermissions } from 'expo-camera';
import { launchImageLibraryAsync } from 'expo-image-picker';
import { useRef, useState } from 'react';
import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useOnAppActive } from '../hooks/useOnAppActive';
import { BackdropButton } from './BackdropButton';
import { Button } from './Button';
import { ImageIcon, XIcon } from './icons';
import { radius } from './theme';
import { useThemedStyles } from './ThemeProvider';

const SHUTTER = 72;

// A full-screen camera that takes one photo, or picks one from the gallery
// (the button beside the shutter). onCapture gets the picture ({ uri, width,
// height }, a temporary file); the caller closes the camera. A gallery photo
// is a copy the picker made in the app's cache, so deleting it once it is
// prepared leaves the gallery alone.
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

  // Android's photo picker needs no permission, so the gallery also works
  // when the camera is not allowed. Cancelling it comes back to the camera.
  const pick = async () => {
    setTaking(true);
    setError(null);
    try {
      const result = await launchImageLibraryAsync({ mediaTypes: ['images'] });
      if (result.canceled) {
        setTaking(false);
        return;
      }
      onCapture(result.assets[0]);
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
  // Not ErrorText: its danger red is hard to read on the black backdrop.
  const errorLine = error && <Text style={styles.text}>{String(error?.message ?? error)}</Text>;

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
          <Button title="Choose from gallery" variant="secondary" size="small" onPress={pick} disabled={taking} />
          {errorLine}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" onCameraReady={() => setReady(true)} />
      {closeButton}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 24 }]}>
        {errorLine}
        <View style={styles.controls}>
          <View style={styles.side}>
            <BackdropButton icon={ImageIcon} label="Choose from gallery" onPress={pick} disabled={taking} />
          </View>
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
          {/* Balances the gallery button, so the shutter stays in the middle. */}
          <View style={styles.side} />
        </View>
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
    controls: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' },
    side: { flex: 1, alignItems: 'center' },
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
