import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

// Runs load() each time the screen comes into focus, so data is fresh after
// coming back from another screen. Wrap load in useCallback.
// Returns { data, error, loading, reload }.
export function useFocusedLoad(load) {
  const [state, setState] = useState({ data: null, error: null, loading: true });

  const run = useCallback(() => {
    let cancelled = false;
    load().then(
      (data) => {
        if (!cancelled) setState({ data, error: null, loading: false });
      },
      (error) => {
        if (!cancelled) setState({ data: null, error, loading: false });
      }
    );
    return () => {
      cancelled = true;
    };
  }, [load]);

  useFocusEffect(run);
  return { ...state, reload: run };
}
