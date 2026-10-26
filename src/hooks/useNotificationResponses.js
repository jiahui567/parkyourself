import { router } from 'expo-router';
import { useEffect } from 'react';

import { useDialog } from '../components/Dialog';
import { sessions, useDatabase } from '../db';
import { listenForResponses } from '../notify/notifications';
import { responseAction } from '../notify/plan';

// Keys of taps already handled, for the whole run of the app.
const handled = new Set();

// Opens Find when a notification or one of its buttons is tapped; Extend
// timer extends first (PLAN.md, "Notifications"). For the root layout, inside
// DatabaseProvider and DialogProvider.
export function useNotificationResponses() {
  const db = useDatabase();
  const showDialog = useDialog();

  useEffect(() => {
    const respond = async (response) => {
      const action = responseAction(response);
      if (!action || handled.has(action.key)) return;
      handled.add(action.key);
      let extendedTo = null;
      if (action.extend) {
        try {
          extendedTo = await sessions.extend(db, action.sessionId);
        } catch (e) {
          showDialog({ title: 'Could not extend the timer', message: String(e?.message ?? e) });
        }
      }
      // navigate, not push: Find for that car may already be open, and then
      // navigate only changes its params. extendedAt is new each time, so that
      // Find reloads and updates the notifications with the new end.
      const params = { id: action.sessionId };
      if (extendedTo != null) params.extendedAt = String(extendedTo);
      try {
        router.navigate({ pathname: '/session/[id]', params });
      } catch (e) {
        showDialog({ title: 'Could not open the parked car', message: String(e?.message ?? e) });
      }
    };
    return listenForResponses(respond);
  }, [db, showDialog]);
}
