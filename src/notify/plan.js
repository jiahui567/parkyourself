import { parkedNotificationText, reminderNotificationText } from '../text/notificationText';
import { reminderTimes } from '../timer/timer';

// Which notifications the phone should show for the parked cars (PLAN.md,
// "Notifications"). Pure functions: notifications.js makes the phone match.

// The buttons on every notification. Android category identifiers must not
// contain ':' or '-'.
export const CATEGORY = 'parked';
export const ACTION_NAVIGATE = 'navigate';
export const ACTION_EXTEND = 'extend';

// One identifier per notification, so posting again replaces it.
export const parkedId = (sessionId) => `parked-${sessionId}`;
export const reminderId = (sessionId, kind) => `reminder-${kind}-${sessionId}`;

// For parked sessions (sessions.listActive rows): one ongoing notification
// each, shown now (at null), and the timer reminders still to come.
// [{ id, kind: 'parked' | 'before' | 'end', at, title, body, data }]
export function notificationPlan(activeSessions, { leadMinutes, nowMs }) {
  return activeSessions.flatMap((session) => {
    const data = { sessionId: session.id, timerEndsAt: session.timer_ends_at };
    const parked = { id: parkedId(session.id), kind: 'parked', at: null, data, ...parkedNotificationText(session) };
    const reminders = reminderTimes(session.timer_ends_at, leadMinutes, nowMs).map(({ kind, at }) => ({
      id: reminderId(session.id, kind),
      kind,
      at,
      data,
      ...reminderNotificationText(session, kind, leadMinutes),
    }));
    return [parked, ...reminders];
  });
}

// What a tap on a notification asks for: { key, sessionId, extend }, or null
// when it is not about a parked session. Navigate, a tap on the notification
// and Extend timer all open Find; Extend extends the timer first. key tells a
// new tap from the same tap seen twice (at start-up it can arrive both as the
// last response and through the listener).
export function responseAction({ notification, actionIdentifier }) {
  const sessionId = notification.request.content.data?.sessionId;
  if (typeof sessionId !== 'string') return null;
  return {
    key: `${notification.request.identifier}:${notification.date}:${actionIdentifier}`,
    sessionId,
    extend: actionIdentifier === ACTION_EXTEND,
  };
}

// Identifiers of shown notifications ({ id, data }) to take away: those for a
// car that is no longer parked, and reminders about a timer that has since
// changed. A reminder for the current timer stays until the user clears it.
export function staleNotificationIds(shown, activeSessions) {
  const timers = new Map(activeSessions.map((s) => [s.id, s.timer_ends_at]));
  return shown
    .filter(({ id, data }) => {
      if (!timers.has(data?.sessionId)) return true;
      return id !== parkedId(data.sessionId) && data.timerEndsAt !== timers.get(data.sessionId);
    })
    .map(({ id }) => id);
}
