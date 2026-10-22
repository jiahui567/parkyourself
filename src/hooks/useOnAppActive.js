import { useEffect } from 'react';
import { AppState } from 'react-native';

// Calls onActive each time the app comes back to the foreground, which a
// screen's focus does not notice: after the user allows something in Android
// settings, for example. Pass a stable function (useCallback, or a reload
// from useFocusedLoad).
export function useOnAppActive(onActive) {
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') onActive();
    });
    return () => subscription.remove();
  }, [onActive]);
}
