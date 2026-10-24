import { useCallback, useEffect, useRef, useState } from 'react';

import { moreAccurate } from '../lib/geo';
import { currentLocation, lastKnownLocation } from '../location/readLocation';
import { useLocationPermission } from './useLocationPermission';

// Park's location. While enabled (Use location when parking, in Settings) and
// allowed, Park reads it once when it opens: the phone's last known position
// at once (still there underground), then a fresh one if it comes in time,
// keeping the more precise. Nothing is tracked. enabled is false while the
// setting is still loading, so nothing is read before it is known.
// Returns { inUse, blocked, reading, finding, error, retry }: blocked when the
// setting is on but Android does not allow the location; reading is
// { lat, lng, accuracyM } or null.
export function useParkLocation(enabled) {
  const { permission, error: permissionError } = useLocationPermission();
  const [state, setState] = useState({ reading: null, done: false, error: null });
  const started = useRef(false);
  // Only the latest read may finish; Try again starts a new one.
  const latest = useRef(0);
  const inUse = Boolean(enabled && permission?.granted);

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

  const retry = () => {
    setState((current) => ({ ...current, done: false, error: null }));
    read();
  };

  useEffect(() => {
    if (inUse && !started.current) {
      started.current = true;
      read();
    }
  }, [inUse, read]);

  return {
    inUse,
    blocked: Boolean(enabled && permission && !permission.granted),
    reading: state.reading,
    finding: inUse && !state.done,
    error: enabled ? (permissionError ?? state.error) : null,
    retry,
  };
}
