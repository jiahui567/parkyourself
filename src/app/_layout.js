import { Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useMemo } from 'react';
import { Appearance } from 'react-native';

import { ParkingIntro } from '../components/ParkingIntro';
import { AppThemeProvider, navigationThemeFor, useAppTheme } from '../components/ThemeProvider';
import { DatabaseProvider } from '../db';
import { useDailyCarParkUpdate } from '../hooks/useDailyCarParkUpdate';
import { useNotificationResponses } from '../hooks/useNotificationResponses';

export default function RootLayout() {
  return (
    <DatabaseProvider>
      <AppThemeProvider>
        <ThemedStack />
      </AppThemeProvider>
    </DatabaseProvider>
  );
}

// The tabs, with Park, Find, Cars and the other detail screens opening on top.
function ThemedStack() {
  const { mode, colours } = useAppTheme();
  const navigationTheme = useMemo(() => navigationThemeFor(mode, colours), [mode, colours]);
  useNotificationResponses();
  useDailyCarParkUpdate();

  // The root view shows behind screens while they animate; app.json fixes it to
  // white, so match it to the theme.
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colours.background);
  }, [colours.background]);
  // Android draws its own dialogs (Alert) in the app's scheme, not the phone's:
  // dark in dark mode. Needs "userInterfaceStyle": "automatic" in app.json.
  useEffect(() => {
    Appearance.setColorScheme(mode);
  }, [mode]);

  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style={colours.statusBar} />
      <Stack
        screenOptions={{
          title: 'Park Yourself',
          headerStyle: { backgroundColor: colours.background },
          headerShadowVisible: false,
          headerTintColor: colours.text,
          contentStyle: { backgroundColor: colours.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      <ParkingIntro />
    </ThemeProvider>
  );
}
