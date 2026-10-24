import { useCallback, useEffect } from 'react';

import { updateCarParkListIfDue } from '../cloud/carParkUpdates';
import { useDatabase } from '../db';
import { useOnAppActive } from './useOnAppActive';

// Only the check reads the clock; the React Compiler lint cannot tell it from
// render code, so the read lives out here.
const clockNow = () => Date.now();

// Downloads the car park list when the app opens or comes back to the front,
// at most once a day (PLAN.md, M12). Runs in the background: nothing waits for
// it and it shows nothing (Database check shows the last failure).
export function useDailyCarParkUpdate() {
  const db = useDatabase();
  const check = useCallback(() => {
    updateCarParkListIfDue(db, clockNow());
  }, [db]);
  useEffect(check, [check]);
  useOnAppActive(check);
}
