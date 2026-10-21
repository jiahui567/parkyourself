import { Tabs } from 'expo-router/js-tabs';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HistoryIcon, HomeIcon, SettingsIcon, SpendingIcon } from '../../components/icons';
import { radius } from '../../components/theme';
import { useAppTheme } from '../../components/ThemeProvider';

const TAB_BAR_HEIGHT = 64;

// The bottom tab bar, shown on every tab. Park, Find and the other detail
// screens open above it from the root stack.
export default function TabsLayout() {
  const { colours } = useAppTheme();
  const insets = useSafeAreaInsets();

  const icon = (Icon) =>
    function TabIcon({ color, focused }) {
      return (
        <View style={[styles.iconPill, focused && { backgroundColor: colours.accentSoft }]}>
          <Icon size={22} color={color} />
        </View>
      );
    };

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colours.accent,
        tabBarInactiveTintColor: colours.muted,
        tabBarStyle: {
          backgroundColor: colours.card,
          borderTopColor: colours.border,
          height: TAB_BAR_HEIGHT + insets.bottom,
          paddingTop: 6,
        },
        tabBarIconStyle: styles.iconSlot,
        tabBarLabelStyle: styles.label,
        headerStyle: { backgroundColor: colours.background },
        headerShadowVisible: false,
        headerTitleAlign: 'left',
        headerTitleStyle: { ...styles.headerTitle, color: colours.text },
        sceneStyle: { backgroundColor: colours.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', headerShown: false, tabBarIcon: icon(HomeIcon) }} />
      <Tabs.Screen name="history" options={{ title: 'History', tabBarIcon: icon(HistoryIcon) }} />
      <Tabs.Screen name="spending" options={{ title: 'Spending', tabBarIcon: icon(SpendingIcon) }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: icon(SettingsIcon) }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  // Wide enough for the pill drawn behind the selected icon.
  iconSlot: { width: 56, height: 30 },
  iconPill: { paddingHorizontal: 16, paddingVertical: 4, borderRadius: radius.pill },
  label: { fontSize: 11, fontWeight: '600', marginTop: 4 },
  headerTitle: { fontSize: 26, fontWeight: '700' },
});
