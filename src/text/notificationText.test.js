import { parkedNotificationText, reminderNotificationText } from './notificationText';

// Local phone time (jest.config.js pins Asia/Kuala_Lumpur).
const at = (localDateTime) => new Date(localDateTime).getTime();

const PARKED = {
  vehicle_name: 'My Myvi',
  place_name: 'Pavilion Bukit Jalil',
  level: 'B2',
  bay: 'C14',
  zone_colour_name: 'Blue',
  started_at: at('2026-10-23T14:15'),
  timer_ends_at: null,
};

describe('parkedNotificationText', () => {
  it('builds the line from PLAN.md, split into title and body', () => {
    expect(parkedNotificationText(PARKED)).toEqual({
      title: 'My Myvi · Pavilion Bukit Jalil',
      body: 'B2 C14 Blue · since 2:15 PM',
    });
  });

  it('adds the timer end when there is a timer', () => {
    const { body } = parkedNotificationText({ ...PARKED, timer_ends_at: at('2026-10-23T16:15') });

    expect(body).toBe('B2 C14 Blue · since 2:15 PM · timer ends 4:15 PM');
  });

  it('leaves out a missing place and spot, and starts the body with a capital', () => {
    const text = parkedNotificationText({
      vehicle_name: 'My Myvi',
      started_at: at('2026-10-23T14:15'),
      timer_ends_at: null,
    });

    expect(text).toEqual({ title: 'My Myvi', body: 'Since 2:15 PM' });
  });
});

describe('reminderNotificationText', () => {
  const timed = { ...PARKED, timer_ends_at: at('2026-10-23T16:15') };

  it('warns ahead by the lead time', () => {
    expect(reminderNotificationText(timed, 'before', 10)).toEqual({
      title: 'My Myvi: timer ends in 10 min',
      body: 'Pavilion Bukit Jalil · B2 C14 Blue · ends 4:15 PM',
    });
  });

  it('says when the timer has ended', () => {
    expect(reminderNotificationText(timed, 'end', 10)).toEqual({
      title: 'My Myvi: timer has ended',
      body: 'Pavilion Bukit Jalil · B2 C14 Blue · ended 4:15 PM',
    });
  });

  it('starts the body with a capital when there is no place or spot', () => {
    const { body } = reminderNotificationText({ vehicle_name: 'My Myvi', timer_ends_at: at('2026-10-23T16:15') }, 'end', 10);

    expect(body).toBe('Ended 4:15 PM');
  });
});
