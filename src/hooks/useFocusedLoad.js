import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

// Runs load() each time the screen comes into focus, so data is fresh after
// coming back from another screen. Wrap load in useCallback.
// Returns { data, error, loading, reload }.
export function useFocusedLoad(load) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  // Numbers each load. Only the latest may set state, so a slow load (a focus
  // load or a reload) never overwrites what a newer one found. Leaving the
  // screen, or load changing, moves it on too, dropping the load in flight.
  const latest = useRef(0);

  // Resolves once the data (or error) is in state, or without setting it when
  // a newer load replaced this one.
  const fetchLatest = useCallback(() => {
    const request = ++latest.current;
    const settle = (next) => {
      if (request === latest.current) setState(next);
    };
    return load().then(
      (data) => settle({ data, error: null, loading: false }),
      (error) => settle({ data: null, error, loading: false })
    );
  }, [load]);

  const run = useCallback(() => {
    fetchLatest();
    return () => {
      latest.current += 1;
    };
  }, [fetchLatest]);

  useFocusEffect(run);
  // For after a save: a caller can keep its button disabled until the screen
  // shows what was saved.
  return { ...state, reload: fetchLatest };
}
