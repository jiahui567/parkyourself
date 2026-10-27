import {
  ACTION_EXTEND,
  ACTION_NAVIGATE,
  notificationPlan,
  notifiedSessions,
  parkedId,
  reminderId,
  responseAction,
  staleNotificationIds,
} from './plan';

// Local phone time (jest.config.js pins Asia/Kuala_Lumpur).
const at = (localDateTime) => new Date(localDateTime).getTime();

const MYVI = {
  id: 's1',
  vehicle_name: 'My Myvi',
  place_name: 'Pavilion Bukit Jalil',
  level: 'B2',
  started_at: at('2026-10-23T14:15'),
  timer_ends_at: at('2026-10-23T16:15'),
};
const AXIA = { id: 's2', vehicle_name: 'Axia', started_at: at('2026-10-23T15:00'), timer_ends_at: null };

describe('notifiedSessions', () => {
  it('keeps the cars this phone parked, not those another phone of the account parked', () => {
    expect(notifiedSessions([{ ...MYVI, parked_here: 1 }, { ...AXIA, parked_here: 0 }])).toEqual([
      { ...MYVI, parked_here: 1 },
    ]);
  });
});

describe('notificationPlan', () => {
  it('shows one ongoing notification per parked car', () => {
    const plan = notificationPlan([MYVI, AXIA], { leadMinutes: 10, nowMs: at('2026-10-23T15:30') });

    expect(plan.filter((n) => n.kind === 'parked').map((n) => n.id)).toEqual([parkedId('s1'), parkedId('s2')]);
    expect(plan.find((n) => n.id === parkedId('s1'))).toMatchObject({
      at: null,
      title: 'My Myvi · Pavilion Bukit Jalil',
      body: 'B2 · since 2:15 PM · timer ends 4:15 PM',
      data: { sessionId: 's1', timerEndsAt: MYVI.timer_ends_at },
    });
  });

  it('schedules the lead-time and end reminders for a timer', () => {
    const plan = notificationPlan([MYVI], { leadMinutes: 10, nowMs: at('2026-10-23T15:30') });

    expect(plan.filter((n) => n.kind !== 'parked')).toMatchObject([
      { id: reminderId('s1', 'before'), at: at('2026-10-23T16:05'), title: 'My Myvi: timer ends in 10 min' },
      { id: reminderId('s1', 'end'), at: at('2026-10-23T16:15'), title: 'My Myvi: timer has ended' },
    ]);
  });

  it('leaves out reminders already due, and has none without a timer', () => {
    const plan = notificationPlan([MYVI, AXIA], { leadMinutes: 10, nowMs: at('2026-10-23T16:10') });

    expect(plan.map((n) => n.id)).toEqual([parkedId('s1'), reminderId('s1', 'end'), parkedId('s2')]);
  });

  it('shows nothing when no car is parked', () => {
    expect(notificationPlan([], { leadMinutes: 10, nowMs: at('2026-10-23T15:30') })).toEqual([]);
  });
});

describe('responseAction', () => {
  // expo-notifications' tap on the default action (the notification itself).
  const TAP = 'expo.modules.notifications.actions.DEFAULT';
  const response = (actionIdentifier, data = { sessionId: 's1' }) => ({
    actionIdentifier,
    notification: { date: 1000, request: { identifier: parkedId('s1'), content: { data } } },
  });

  it('opens the parked car for a tap or Navigate', () => {
    expect(responseAction(response(TAP))).toMatchObject({ sessionId: 's1', extend: false });
    expect(responseAction(response(ACTION_NAVIGATE))).toMatchObject({ sessionId: 's1', extend: false });
  });

  it('extends the timer for Extend timer', () => {
    expect(responseAction(response(ACTION_EXTEND))).toMatchObject({ sessionId: 's1', extend: true });
  });

  it('gives the same tap the same key, and another button another key', () => {
    expect(responseAction(response(ACTION_EXTEND)).key).toBe(responseAction(response(ACTION_EXTEND)).key);
    expect(responseAction(response(ACTION_EXTEND)).key).not.toBe(responseAction(response(TAP)).key);
  });

  it('gives a tap on the notification posted again a new key, so Extend works more than once', () => {
    const first = response(ACTION_EXTEND);
    const reposted = { ...first, notification: { ...first.notification, date: 2000 } };

    expect(responseAction(reposted).key).not.toBe(responseAction(first).key);
  });

  it('ignores a notification that is not about a parked car', () => {
    expect(responseAction(response(TAP, {}))).toBeNull();
    expect(responseAction(response(TAP, null))).toBeNull();
  });
});

describe('staleNotificationIds', () => {
  const shown = (id, sessionId, timerEndsAt) => ({ id, data: { sessionId, timerEndsAt } });

  it('takes away every notification of a car that is no longer parked', () => {
    const ids = staleNotificationIds(
      [shown(parkedId('s9'), 's9', null), shown(reminderId('s9', 'end'), 's9', 1)],
      [MYVI]
    );

    expect(ids).toEqual([parkedId('s9'), reminderId('s9', 'end')]);
  });

  it('takes away reminders about a timer that was extended, but keeps the parked one', () => {
    const old = at('2026-10-23T15:15');
    const ids = staleNotificationIds(
      [shown(parkedId('s1'), 's1', old), shown(reminderId('s1', 'end'), 's1', old)],
      [MYVI]
    );

    expect(ids).toEqual([reminderId('s1', 'end')]);
  });

  it('keeps a reminder for the current timer', () => {
    const ids = staleNotificationIds([shown(reminderId('s1', 'before'), 's1', MYVI.timer_ends_at)], [MYVI]);

    expect(ids).toEqual([]);
  });

  it('takes away a notification that belongs to no parked car', () => {
    expect(staleNotificationIds([{ id: 'other', data: {} }], [MYVI])).toEqual(['other']);
  });
});
