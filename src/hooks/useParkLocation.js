import { useCallback, useEffect, useRef, useState } from 'react';

import { moreAccurate } from '../lib/geo';
import { currentLocation, lastKnownLocation } from '../location/readLocation';
import { useLocationPermission } from './useLocationPermission';

// Park's location. While it is allowed, Park reads it once when it opens: the
// phone's last known position at once (still there underground), then a fresh
// one if it comes in time, keeping the more precise. Nothing is tracked.
// Returns { permission, reading, finding, error, allow, retry }; reading is
// { lat, lng, accuracyM } or null.
export function useParkLocation() {
  const { permission, error: permissionError, allow } = useLocationPermission();
  const [state, setState] = useState({ reading: null, done: false, error: null });
  const started = useRef(false);
  // Only the latest read may finish; Try again starts a new one.
  const latest = useRef(0);

  const read = useCallback(async () => {
    const request = ++latest.current;
    const isLatest = () => request === latest.current;
    // Each read may fail on its own; the error shows only when neither gave a reading.
    let cached = null;
    let cachedError = null;
    try {
      cached = await lastKnownLocation();
      if (isLatest() && cached) setState((current) => ({ ...current, reading: moreAccurate(current.reading, cached) }));
    } catch (e) {
      cachedError = e;
    }
    try {
      const fresh = await currentLocation();
      if (isLatest()) {
        setState((current) => ({
          reading: moreAccurate(current.reading, fresh),
          done: true,
          error: fresh || cached ? null : cachedError,
        }));
      }
    } catch (e) {
      if (isLatest()) setState((current) => ({ ...current, done: true, error: cached ? null : e }));
    }
  }, []);

  // Read once the permission is known to be allowed, also when it was just allowed on Park.
  useEffect(() => {
    if (permission?.granted && !started.current) {
      started.current = true;
      read();
    }
  }, [permission, read]);

  const retry = () => {
    setState((current) => ({ ...current, done: false, error: null }));
    read();
  };

  return {
    permission,
    reading: state.reading,
    finding: Boolean(permission?.granted) && !state.done,
    error: permissionError ?? state.error,
    allow,
    retry,
  };
}
