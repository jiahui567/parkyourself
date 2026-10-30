import { useCallback } from 'react';
import { Linking } from 'react-native';

import { askLocationPermission, locationPermission } from '../location/readLocation';
import { useFocusedLoad } from './useFocusedLoad';
import { useOnAppActive } from './useOnAppActive';

// The location permission ({ granted, canAskAgain }, null until checked), read
// again on focus and when the app comes back from Android settings. allow()
// asks for it and returns the answer, or opens the app's settings page once
// Android no longer asks and returns null (the answer comes when the app is
// back); it rejects if that fails. Returns { permission, error, allow }.
export function useLocationPermission() {
  const load = useCallback(() => locationPermission(), []);
  const { data: permission, error, reload } = useFocusedLoad(load);
  useOnAppActive(reload);

  const allow = useCallback(async () => {
    if (permission?.canAskAgain === false) {
      await Linking.openSettings();
      return null;
    }
    const answer = await askLocationPermission();
    await reload();
    return answer;
  }, [permission, reload]);

  return { permission, error, allow };
}
