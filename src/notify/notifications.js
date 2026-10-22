import * as Notifications from 'expo-notifications';
// A named import: the lint import plugin cannot see this enum through the namespace.
import { AndroidImportance } from 'expo-notifications';

import { preferences, sessions } from '../db';
import { ACTION_EXTEND, ACTION_NAVIGATE, CATEGORY, notificationPlan, staleNotificationIds } from './plan';

// The phone side of the notifications: expo-notifications calls only. What to
// show is decided in plan.js.

// Android channels: the parked notification sits quietly in the tray, a
// reminder makes a sound and shows on screen.
const PARKED_CHANNEL = 'parked';
const REMINDER_CHANNEL = 'reminders';

let setUp = null;

// Channels, buttons and how a notification shows while the app is open, once
// per app run. Android 13 asks for the permission only once a channel exists.
function ensureSetUp() {
  setUp ??= (async () => {
    Notifications.setNotificationHandler({
      handleNotification: async (notification) => {
        const reminder = notification.request.content.data?.kind !== 'parked';
        return { shouldShowBanner: reminder, shouldShowList: true, shouldPlaySound: reminder, shouldSetBadge: false };
      },
    });
    await Notifications.setNotificationChannelAsync(PARKED_CHANNEL, {
      name: 'Parked cars',
      importance: AndroidImportance.LOW,
    });
    await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL, {
      name: 'Timer reminders',
      importance: AndroidImportance.HIGH,
    });
    // Both buttons open the app, so no background task is needed (PLAN.md, "Notifications").
    await Notifications.setNotificationCategoryAsync(CATEGORY, [
      { identifier: ACTION_NAVIGATE, buttonTitle: 'Navigate', options: { opensAppToForeground: true } },
      { identifier: ACTION_EXTEND, buttonTitle: 'Extend timer', options: { opensAppToForeground: true } },
    ]);
  })().catch((e) => {
    // Try again on the next sync.
    setUp = null;
    throw e;
  });
  return setUp;
}

// Asks for the notification permission when the user taps Allow
// notifications in Settings. Returns whether notifications may be shown.
export async function askNotificationPermission() {
  await ensureSetUp();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted || !current.canAskAgain) return current.granted;
  return (await Notifications.requestPermissionsAsync()).granted;
}

// { granted, canAskAgain }, for Settings.
export function notificationPermission() {
  return Notifications.getPermissionsAsync();
}

const contentOf = (notification) => ({
  title: notification.title,
  body: notification.body,
  data: { ...notification.data, kind: notification.kind },
  categoryIdentifier: CATEGORY,
  // The parked notification cannot be swiped away (Android 14 still allows
  // it) and stays when tapped; a reminder goes once seen.
  sticky: notification.kind === 'parked',
  autoDismiss: notification.kind !== 'parked',
});

const triggerOf = (notification) =>
  notification.at == null
    ? { channelId: PARKED_CHANNEL }
    : { type: Notifications.SchedulableTriggerInputTypes.DATE, date: notification.at, channelId: REMINDER_CHANNEL };

// At most one prompt per run of the app: on Android the prompt itself sends
// the app to the background and back, which would sync and ask again.
let askedThisRun = false;

async function sync(db, askPermission) {
  await ensureSetUp();
  const [permission, active, prefs, shown, scheduled] = await Promise.all([
    Notifications.getPermissionsAsync(),
    sessions.listActive(db),
    preferences.get(db),
    Notifications.getPresentedNotificationsAsync(),
    Notifications.getAllScheduledNotificationsAsync(),
  ]);
  let { granted } = permission;
  // Asked once a car is parked, when notifications first matter (PLAN.md,
  // "Notifications"), so a problem here can never stop the car being parked.
  if (!granted && permission.canAskAgain && askPermission && !askedThisRun && active.length > 0) {
    askedThisRun = true;
    granted = (await Notifications.requestPermissionsAsync()).granted;
  }
  const plan = granted ? notificationPlan(active, { leadMinutes: prefs.reminderLeadMinutes, nowMs: Date.now() }) : [];
  const wanted = new Set(plan.map((notification) => notification.id));

  const shownIds = shown.map((n) => ({ id: n.request.identifier, data: n.request.content.data }));
  for (const id of staleNotificationIds(shownIds, active)) await Notifications.dismissNotificationAsync(id);
  for (const { identifier } of scheduled) {
    if (!wanted.has(identifier)) await Notifications.cancelScheduledNotificationAsync(identifier);
  }
  // The same identifier replaces what is shown or scheduled, so this also
  // updates a timer that was extended.
  for (const notification of plan) {
    await Notifications.scheduleNotificationAsync({
      identifier: notification.id,
      content: contentOf(notification),
      trigger: triggerOf(notification),
    });
  }
}

// Calls onResponse(response) for the tap that started the app, if any, and
// for every later tap on a notification or its buttons. Returns a function
// that stops listening.
export function listenForResponses(onResponse) {
  const last = Notifications.getLastNotificationResponse();
  // Cleared, so the next start of the app does not see the same tap again
  // (and extend the timer twice).
  Notifications.clearLastNotificationResponse();
  if (last) onResponse(last);
  const subscription = Notifications.addNotificationResponseReceivedListener(onResponse);
  return () => subscription.remove();
}

let queue = Promise.resolve();

// Makes the phone's notifications match the parked cars: each car's ongoing
// notification, its timer reminders, and nothing for cars no longer parked.
// Safe to run at any time; runs run one after another. askPermission: ask for
// the permission if a car is parked and Android still allows asking (Find).
export function syncNotifications(db, { askPermission = false } = {}) {
  const run = queue
    .then(() => sync(db, askPermission))
    .catch((e) => {
      throw new Error(`Could not update the parking notifications: ${String(e?.message ?? e)}`, { cause: e });
    });
  // The caller gets run's error; the queue only waits for it to finish.
  queue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}
