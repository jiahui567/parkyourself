import { Stack } from 'expo-router';

import { DatabaseProvider } from '../db';

export default function RootLayout() {
  return (
    <DatabaseProvider>
      <Stack screenOptions={{ title: 'Park Yourself' }} />
    </DatabaseProvider>
  );
}
