import { useState } from 'react';
import { FlatList, Image, Modal, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { photoLabel } from '../text/photoText';
import { BackdropButton } from './BackdropButton';
import { ShareIcon, TrashIcon, XIcon } from './icons';
import { useThemedStyles } from './ThemeProvider';

// Photos full screen, swiped left and right. index is the photo to open, or
// null when closed. onShare(index) and onDelete(index), when given, add a
// share and a delete button; the caller asks before deleting and moves index
// on afterwards.
export function PhotoViewer({ uris, index, onClose, onShare, onDelete }) {
  const open = index != null && uris.length > 0;
  return (
    <Modal visible={open} animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      {/* A new key after a delete starts the list again at the new index. */}
      {open && (
        <ViewerBody
          key={uris.length}
          uris={uris}
          startIndex={index}
          onClose={onClose}
          onShare={onShare}
          onDelete={onDelete}
        />
      )}
    </Modal>
  );
}

function ViewerBody({ uris, startIndex, onClose, onShare, onDelete }) {
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
        {/* Centred on the screen, whatever buttons sit on either side. */}
        <View style={[styles.countRow, { top: insets.top + 12 }]} pointerEvents="none">
          <Text style={styles.count}>{photoLabel(current, uris.length)}</Text>
        </View>
        <BackdropButton icon={XIcon} label="Close photo" onPress={onClose} />
        <View style={styles.actions}>
          {onShare && <BackdropButton icon={ShareIcon} label="Share this photo" onPress={() => onShare(current)} />}
          {onDelete && <BackdropButton icon={TrashIcon} label="Delete this photo" onPress={() => onDelete(current)} />}
        </View>
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
    // As tall as the buttons, so the count lines up with them.
    countRow: { position: 'absolute', left: 0, right: 0, height: 44, alignItems: 'center', justifyContent: 'center' },
    count: { color: c.onBackdrop, fontWeight: '600' },
    actions: { flexDirection: 'row', gap: 8 },
  });
