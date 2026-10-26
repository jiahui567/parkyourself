import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { SearchIcon, XIcon } from './icons';
import { radius } from './theme';
import { useAppTheme, useThemedStyles } from './ThemeProvider';

const ICON_SIZE = 18;

// A search box like the place picker's on Park: a search icon, the input, and
// a clear button once something is typed. Pass accessibilityLabel ("Search
// places"); other props go to TextInput.
export function SearchField({ value, onChangeText, ...inputProps }) {
  const { colours } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.search}>
      <SearchIcon size={ICON_SIZE} color={colours.muted} />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor={colours.muted}
        selectionColor={colours.accent}
        autoCorrect={false}
        returnKeyType="search"
        {...inputProps}
      />
      {value !== '' && (
        <Pressable accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={12} onPress={() => onChangeText('')}>
          <XIcon size={ICON_SIZE} color={colours.muted} />
        </Pressable>
      )}
    </View>
  );
}

const createStyles = (c) =>
  StyleSheet.create({
    search: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      borderRadius: radius.control,
      paddingHorizontal: 14,
    },
    input: { flex: 1, paddingVertical: 12, fontSize: 16, color: c.text },
  });
