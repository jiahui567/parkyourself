import {
  dataFooterText,
  isParkedElsewhere,
  parkedElsewhereText,
  signOutWarning,
  syncErrorText,
  syncRowValue,
  syncStatusText,
} from './syncText';

const at = (t) => new Date(t).getTime();
const NOW = at('2026-10-27T15:00');
const A = { id: 'user-a', email: 'a@example.test' };
const B = { id: 'user-b', email: 'b@example.test' };
const OFFLINE = 'Could not reach the server. Check your connection and try again.';

const state = (changes = {}) => ({
  account: A,
  owner: A,
  otherAccount: false,
  restarting: false,
  pending: 0,
  lastSyncedAt: null,
  lastError: null,
  refused: [],
  ...changes,
});
const otherAccount = state({ account: B, otherAccount: true });

const elsewhere = {
  table: 'parking_session',
  id: 's',
  code: '23505',
  constraint: 'one_active_session_per_vehicle',
  vehicle_name: 'My Myvi',
  other: { id: 'o', level: 'L3', bay: 'C14', started_at: at('2026-10-27T09:00') },
};

describe('syncRowValue', () => {
  it.each([
    ['Off', state({ account: null })],
    ['On', state()],
    ['On', state({ owner: null })],
    ['Paused', otherAccount],
  ])('is %s', (value, given) => {
    expect(syncRowValue(given)).toBe(value);
  });
});

describe('syncStatusText', () => {
  it('asks a signed-out user to sign in, and says photos stay', () => {
    expect(syncStatusText(state({ account: null }), NOW)).toBe(
      'Sign in to back up your cars, places, rates, holidays and parking. Photos stay on this phone.'
    );
  });

  it('names the account the phone is backed up to when another one signs in', () => {
    expect(syncStatusText(otherAccount, NOW)).toBe(
      "This phone's data is backed up to a@example.test. Sign in with that account to keep backing it up."
    );
  });

  it('says everything goes again to an account made again with the same email', () => {
    const restarting = state({ account: { id: 'user-a2', email: A.email }, restarting: true, lastSyncedAt: NOW });

    expect(syncStatusText(restarting, NOW)).toBe(
      'This account is new, so everything on this phone is backed up to it again at the next sync.'
    );
    expect(syncErrorText({ ...restarting, lastError: OFFLINE })).toBe(OFFLINE);
  });

  it('says when the last sync was, today by its time', () => {
    expect(syncStatusText(state({ lastSyncedAt: at('2026-10-27T10:05') }), NOW)).toBe(
      'Everything is backed up. Last sync at 10:05 AM.'
    );
  });

  it('gives the date of a sync before today', () => {
    expect(syncStatusText(state({ lastSyncedAt: at('2026-10-26T22:00') }), NOW)).toBe(
      'Everything is backed up. Last sync on Mon, 26 Oct 2026.'
    );
  });

  it('counts the changes that wait', () => {
    expect(syncStatusText(state({ pending: 1 }), NOW)).toBe('1 change waiting to back up.');
    expect(syncStatusText(state({ pending: 3, lastError: OFFLINE }), NOW)).toBe('3 changes waiting to back up.');
  });

  it('asks the user to end one of two parkings of the same car', () => {
    expect(syncStatusText(state({ pending: 1, refused: [elsewhere] }), NOW)).toBe(
      'My Myvi is parked on another phone too, so that parking is not backed up. End one of them with Found my car.'
    );
  });

  it('counts other refused changes apart from the ones waiting', () => {
    const place = { table: 'place', id: 'p', code: '23505', constraint: 'place_name_unique' };

    expect(syncStatusText(state({ pending: 3, refused: [place] }), NOW)).toBe(
      '1 change could not be backed up yet. They are tried again each time. 2 changes waiting to back up.'
    );
  });
});

describe('syncErrorText', () => {
  it('gives the last error while changes wait', () => {
    expect(syncErrorText(state({ pending: 2, lastError: OFFLINE }))).toBe(OFFLINE);
  });

  it('is null when nothing waits, the user is signed out or the phone belongs to another account', () => {
    expect(syncErrorText(state({ lastError: OFFLINE }))).toBeNull();
    expect(syncErrorText(state({ account: null, pending: 2, lastError: OFFLINE }))).toBeNull();
    expect(syncErrorText({ ...otherAccount, pending: 2, lastError: OFFLINE })).toBeNull();
  });

  it('leaves out the refused rows, which have their own sentence', () => {
    expect(syncErrorText(state({ pending: 1, refused: [elsewhere], lastError: OFFLINE }))).toBeNull();
  });
});

describe('dataFooterText', () => {
  it('says the backup is on while signed in to the phone\'s account', () => {
    expect(dataFooterText(state())).toBe('Backup to your account is on. Photos stay on this phone.');
  });

  it('says the data stays here otherwise, or before the state has loaded', () => {
    expect(dataFooterText(state({ account: null }))).toBe('Your data stays on this phone.');
    expect(dataFooterText(otherAccount)).toBe('Your data stays on this phone.');
    expect(dataFooterText(null)).toBe('Your data stays on this phone.');
  });
});

describe('signOutWarning', () => {
  it('says the changes stay on the phone', () => {
    expect(signOutWarning(2)).toEqual({
      title: 'Sign out before everything is backed up?',
      message:
        '2 changes have not reached your account yet. ' +
        'They stay on this phone and are backed up when you sign in again with this account.',
    });
  });

  it('counts one change as one', () => {
    expect(signOutWarning(1).message).toMatch(/^1 change has not reached/);
  });
});

describe('parkedElsewhereText', () => {
  it('gives the other phone\'s spot and start time', () => {
    expect(isParkedElsewhere(elsewhere)).toBe(true);
    expect(parkedElsewhereText(elsewhere, NOW)).toBe(
      'This car is also parked on another phone (L3 C14, since 9:00 AM), so this parking is not backed up. ' +
        'End one of them with Found my car.'
    );
  });

  it('gives the date of a start before today', () => {
    const yesterday = { ...elsewhere, other: { ...elsewhere.other, started_at: at('2026-10-26T21:30') } };

    expect(parkedElsewhereText(yesterday, NOW)).toMatch(/\(L3 C14, since Mon, 26 Oct 2026, 9:30 PM\)/);
  });

  it('leaves out what the other phone did not record', () => {
    expect(parkedElsewhereText({ ...elsewhere, other: null }, NOW)).toBe(
      'This car is also parked on another phone, so this parking is not backed up. End one of them with Found my car.'
    );
  });

  it('is only for a second active session', () => {
    expect(isParkedElsewhere({ constraint: 'place_name_unique' })).toBe(false);
    expect(isParkedElsewhere(null)).toBe(false);
  });
});
