import { Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useMemo } from 'react';
import { Appearance } from 'react-native';

import { AppError } from '../components/AppError';
import { DialogProvider } from '../components/Dialog';
import { ParkingIntro } from '../components/ParkingIntro';
import { AppThemeProvider, navigationThemeFor, useAppTheme } from '../components/ThemeProvider';
import { DatabaseProvider } from '../db';
import { useDailyCarParkUpdate } from '../hooks/useDailyCarParkUpdate';
import { useNotificationResponses } from '../hooks/useNotificationResponses';
import { useSync } from '../hooks/useSync';

// expo-router shows this instead of the app when the layout or any screen
// throws while drawing, such as when the database cannot be opened or
// migrated (expo-sqlite throws while rendering): without it a release build
// closes, and in that case at every start.
export function ErrorBoundary({ error, retry }) {
  return <AppError error={error} retry={retry} />;
}

export default function RootLayout() {
  return (
    <DatabaseProvider>
      <AppThemeProvider>
        <DialogProvider>
          <ThemedStack />
        </DialogProvider>
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
  useSync();

  // The root view shows behind screens while they animate; app.json fixes it to
  // white, so match it to the theme.
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colours.background);
  }, [colours.background]);
  // Android draws what is still its own (the app's dialogs are not since
  // 2026-10-26) in the app's scheme, not the phone's: dark in dark mode.
  // Needs "userInterfaceStyle": "automatic" in app.json.
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
