import { formatDate, formatTime, localDateKey } from '../lib/time';
import { spotText } from './sessionText';

// Text about the sync (C3) for Settings, Account and Find. state is what
// syncState.get gives (src/db/sync.js).

const ACTIVE_ELSEWHERE = 'one_active_session_per_vehicle';

const changesText = (n) => (n === 1 ? '1 change' : `${n} changes`);
const isToday = (ms, nowMs) => localDateKey(ms) === localDateKey(nowMs);

// The changes that wait for the next push, apart from the ones the server
// refused (those are told about on their own).
const waitingCount = (state) => Math.max(0, state.pending - state.refused.length);

// The value on Settings' Back up and sync row.
export function syncRowValue(state) {
  if (!state.account) return 'Off';
  return state.otherAccount ? 'Paused' : 'On';
}

// The second active session the server refused is this one: the car is
// parked on another phone too. Never merged: the user ends one.
export function isParkedElsewhere(refusal) {
  return refusal?.constraint === ACTIVE_ELSEWHERE;
}

// For Find, on the session the server refused: 'This car is also parked on
// another phone (L3 C14, since 9:00 AM), so this parking is not backed up.
// End one of them with Found my car.' A start before today gives the date.
export function parkedElsewhereText(refusal, nowMs) {
  const other = refusal.other;
  const since = other?.started_at
    ? `since ${isToday(other.started_at, nowMs) ? '' : `${formatDate(other.started_at)}, `}${formatTime(other.started_at)}`
    : null;
  const where = (other ? [spotText(other), since] : []).filter(Boolean).join(', ');
  return (
    `This car is also parked on another phone${where ? ` (${where})` : ''}, so this parking is not backed up. ` +
    'End one of them with Found my car.'
  );
}

// Asked before signing out while changes still wait after the last push
// (PLAN.md, "How the sync works", step 9). Nothing is lost: they stay here.
export function signOutWarning(pending) {
  return {
    title: 'Sign out before everything is backed up?',
    message:
      `${changesText(pending)} ${pending === 1 ? 'has' : 'have'} not reached your account yet. ` +
      'They stay on this phone and are backed up when you sign in again with this account.',
  };
}

// Asked on Account when the account just signed in is not the one this
// phone's data is backed up to (PLAN.md, "How the sync works", step 9).
export function addPhoneDataQuestion(state) {
  return {
    title: `Add this phone's data to ${state.account.email ?? 'this account'}?`,
    message:
      `This phone's cars, places, rates, holidays and parking are backed up to ${state.owner.email ?? 'another account'}. ` +
      'Add them to this account and sync with it from now on, or sign out. The other account keeps its backup.',
  };
}

// How the backup stands, in a sentence or two, for Settings and Account.
export function syncStatusText(state, nowMs) {
  if (!state.account) return 'Sign in to back up your cars, places, rates, holidays and parking. Photos stay on this phone.';
  if (state.otherAccount) {
    return (
      `This phone's data is backed up to ${state.owner.email ?? 'another account'}. ` +
      'Add it to this account, or sign in with that account to keep backing it up there.'
    );
  }
  if (state.restarting) return 'This account is new, so everything on this phone is backed up to it again at the next sync.';
  const lines = [];
  const elsewhere = state.refused.filter(isParkedElsewhere);
  for (const refusal of elsewhere) {
    lines.push(
      `${refusal.vehicle_name ?? 'A car'} is parked on another phone too, so that parking is not backed up. ` +
        'End one of them with Found my car.'
    );
  }
  const otherRefused = state.refused.length - elsewhere.length;
  if (otherRefused > 0) lines.push(`${changesText(otherRefused)} could not be backed up yet. They are tried again each time.`);
  const waiting = waitingCount(state);
  if (waiting > 0) {
    lines.push(`${changesText(waiting)} waiting to back up.`);
  } else if (!state.refused.length) {
    lines.push('Everything is backed up.');
    if (state.lastSyncedAt) {
      const when = isToday(state.lastSyncedAt, nowMs) ? `at ${formatTime(state.lastSyncedAt)}` : `on ${formatDate(state.lastSyncedAt)}`;
      lines.push(`Last sync ${when}.`);
    }
  }
  return lines.join(' ');
}

// Why the last push failed, while changes still wait for it, for ErrorText;
// otherwise null.
export function syncErrorText(state) {
  if (!state.account || state.otherAccount) return null;
  return state.restarting || waitingCount(state) > 0 ? state.lastError : null;
}

// The Settings footer: the backup is on while signed in to the account the
// phone is backed up to.
export function dataFooterText(state) {
  return state?.account && !state.otherAccount
    ? 'Backup to your account is on. Photos stay on this phone.'
    : 'Your data stays on this phone.';
}
