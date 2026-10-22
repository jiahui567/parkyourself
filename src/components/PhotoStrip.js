import { Image, Pressable, ScrollView, StyleSheet } from 'react-native';

import { photoLabel } from '../text/photoText';
import { radius } from './theme';
import { useThemedStyles } from './ThemeProvider';

// A row of photo thumbnails, oldest first (the pillar sign leads). Tapping one
// calls onOpen(index), unless disabled. Shows nothing when there are no photos.
export function PhotoStrip({ uris, onOpen, disabled = false }) {
  const styles = useThemedStyles(createStyles);
  if (uris.length === 0) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {uris.map((uri, index) => (
        <Pressable
          key={uri}
          accessibilityRole="button"
          accessibilityLabel={photoLabel(index, uris.length)}
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={() => onOpen(index)}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Image source={{ uri }} style={styles.thumb} />
        </Pressable>
      ))}
    </ScrollView>
  );
}

const createStyles = (c) =>
  StyleSheet.create({
    row: { gap: 8 },
    // 3:4, the shape of a phone photo held upright.
    thumb: { width: 96, height: 128, borderRadius: radius.control, backgroundColor: c.surface },
    pressed: { opacity: 0.85 },
  });
