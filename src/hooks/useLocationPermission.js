import { useCallback } from 'react';
import { Linking } from 'react-native';

import { askLocationPermission, locationPermission } from '../location/readLocation';
import { useFocusedLoad } from './useFocusedLoad';
import { useOnAppActive } from './useOnAppActive';

// The location permission ({ granted, canAskAgain }, null until checked), read
// again on focus and when the app comes back from Android settings. allow()
// asks for it, or opens the app's settings page once Android no longer asks;
// it rejects if that fails. Returns { permission, error, allow }.
export function useLocationPermission() {
  const load = useCallback(() => locationPermission(), []);
  const { data: permission, error, reload } = useFocusedLoad(load);
  useOnAppActive(reload);

  const allow = useCallback(async () => {
    if (permission?.canAskAgain === false) {
      await Linking.openSettings();
      return;
    }
    await askLocationPermission();
    await reload();
  }, [permission, reload]);

  return { permission, error, allow };
}
