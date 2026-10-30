import { useCallback, useEffect } from 'react';

import { syncNow } from '../cloud/sync';
import { onSyncedChange, useDatabase } from '../db';
import { useOnAppActive } from './useOnAppActive';

// How long after a save the sync follows: one push for a burst of saves (a
// park writes the place, its rates and the session), and by then the save's
// transaction has committed.
const AFTER_SAVE_MS = 5000;

// Syncs while signed in: when the app opens or comes back to the front, and a
// few seconds after a save (PLAN.md, "How the sync works", step 5). Never in
// the background. For the root layout. Nothing waits for it and it shows
// nothing: Settings and Account show how the last one went, and what the pull
// changed reaches the screens through onPulledChange (useFocusedLoad, and
// Home for the notifications).
export function useSync() {
  const db = useDatabase();
  const sync = useCallback(() => {
    syncNow(db);
  }, [db]);
  useEffect(sync, [sync]);
  useOnAppActive(sync);
  useEffect(() => {
    let timer = null;
    const stopListening = onSyncedChange((databasePath) => {
      // Only this database: Database check's self-test writes a throwaway one.
      if (databasePath !== db.databasePath) return;
      clearTimeout(timer);
      timer = setTimeout(sync, AFTER_SAVE_MS);
    });
    return () => {
      stopListening();
      clearTimeout(timer);
    };
  }, [db, sync]);
}
