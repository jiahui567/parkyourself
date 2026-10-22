import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

// The current time, refreshed every intervalMs so elapsed times tick on screen,
// and each time the screen comes back into focus: a screen left open under
// another (Home while the user parks) would otherwise show a time from before
// what was done there.
export function useNow(intervalMs = 30 * 1000) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  useFocusEffect(
    useCallback(() => {
      setNow(Date.now());
    }, [])
  );
  return now;
}
