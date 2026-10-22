import { formatMinutes, formatTime } from '../lib/time';
import { spotText } from './sessionText';

// Notification text for a parked session row with its vehicle_name and
// place_name (sessions.listActive). A notification cannot update itself, so
// it shows times, never the elapsed time or a fee (PLAN.md, "Notifications").

const capitalise = (text) => text[0].toUpperCase() + text.slice(1);
const nameLine = (session) => [session.vehicle_name, session.place_name].filter(Boolean).join(' · ');

// { title: 'My Myvi · Pavilion Bukit Jalil', body: 'B2 C14 Blue · since 2:15 PM · timer ends 4:15 PM' }
export function parkedNotificationText(session) {
  const body = [
    spotText(session),
    `since ${formatTime(session.started_at)}`,
    session.timer_ends_at != null && `timer ends ${formatTime(session.timer_ends_at)}`,
  ]
    .filter(Boolean)
    .join(' · ');
  return { title: nameLine(session), body: capitalise(body) };
}

// kind 'before': { title: 'My Myvi: timer ends in 10 min', body: 'Pavilion Bukit Jalil · B2 C14 Blue · ends 4:15 PM' }
// kind 'end': { title: 'My Myvi: timer has ended', body: '... · ended 4:15 PM' }
export function reminderNotificationText(session, kind, leadMinutes) {
  const ends = formatTime(session.timer_ends_at);
  const title =
    kind === 'before'
      ? `${session.vehicle_name}: timer ends in ${formatMinutes(leadMinutes)}`
      : `${session.vehicle_name}: timer has ended`;
  const when = kind === 'before' ? `ends ${ends}` : `ended ${ends}`;
  const body = [session.place_name, spotText(session), when].filter(Boolean).join(' · ');
  return { title, body: capitalise(body) };
}
