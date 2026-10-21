import { Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useMemo } from 'react';

import { AppThemeProvider, navigationThemeFor, useAppTheme } from '../components/ThemeProvider';
import { DatabaseProvider } from '../db';

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

  // The root view shows behind screens while they animate; app.json fixes it to
  // white, so match it to the theme.
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colours.background);
  }, [colours.background]);

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
    </ThemeProvider>
  );
}
