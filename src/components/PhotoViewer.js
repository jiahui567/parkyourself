import { useState } from 'react';
import { FlatList, Image, Modal, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { photoLabel } from '../text/photoText';
import { BackdropButton } from './BackdropButton';
import { TrashIcon, XIcon } from './icons';
import { useThemedStyles } from './ThemeProvider';

// Photos full screen, swiped left and right. index is the photo to open, or
// null when closed. onDelete(index), when given, adds a delete button; the
// caller asks before deleting and moves index on afterwards.
export function PhotoViewer({ uris, index, onClose, onDelete }) {
  const open = index != null && uris.length > 0;
  return (
    <Modal visible={open} animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      {/* A new key after a delete starts the list again at the new index. */}
      {open && <ViewerBody key={uris.length} uris={uris} startIndex={index} onClose={onClose} onDelete={onDelete} />}
    </Modal>
  );
}

function ViewerBody({ uris, startIndex, onClose, onDelete }) {
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [current, setCurrent] = useState(Math.min(startIndex, uris.length - 1));

  return (
    <View style={styles.screen}>
      <FlatList
        data={uris}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={current}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        keyExtractor={(uri) => uri}
        onMomentumScrollEnd={(event) => setCurrent(Math.round(event.nativeEvent.contentOffset.x / width))}
        renderItem={({ item, index }) => (
          <Image
            source={{ uri: item }}
            style={{ width, height }}
            resizeMode="contain"
            accessibilityLabel={photoLabel(index, uris.length)}
          />
        )}
      />
      <View style={[styles.top, { paddingTop: insets.top + 12 }]}>
        <BackdropButton icon={XIcon} label="Close photo" onPress={onClose} />
        <Text style={styles.count}>{photoLabel(current, uris.length)}</Text>
        {onDelete ? (
          <BackdropButton icon={TrashIcon} label="Delete this photo" onPress={() => onDelete(current)} />
        ) : (
          <View style={styles.spacer} />
        )}
      </View>
    </View>
  );
}

const createStyles = (c) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.backdrop },
    top: {
      position: 'absolute',
      top: 0,
      left: 16,
      right: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    count: { color: c.onBackdrop, fontWeight: '600' },
    // Keeps the count centred when there is no delete button.
    spacer: { width: 44 },
  });
