import { openMigratedTestDatabase } from '../../test/testDatabase';
import { holidays, onPulledChange, places, sessions, settings, syncRows, syncState, vehicles } from '../db';
import { DELETE_TIMED_OUT_TEXT, LOCAL_SYNC_ERROR_TEXT, SIGN_OUT_TIMED_OUT_TEXT, TIMED_OUT_TEXT } from '../text/cloudText';
import { deleteAccount, pullSyncedRows, pushSyncedRows, signedInAccount, signOut } from './supabase';
import {
  addPhoneDataToAccount,
  batches,
  CALL_TIMEOUT_MS,
  DELETE_TIMEOUT_MS,
  deleteAccountAndForget,
  errorTextFor,
  loadAccount,
  PULL_OVERLAP_US,
  PULL_PAGE,
  PUSH_BATCH,
  pushBeforeSignOut,
  SIGN_OUT_WAIT_MS,
  signOutKeepingData,
  syncNow,
} from './sync';

// No network in Jest: the server calls are replaced, and the server is "set up".
// src/cloud/syncTwoPhones.test.js runs the sync against a fake server instead.
jest.mock('./supabase', () => ({
  supabaseUrl: 'https://example.supabase.co',
  signedInAccount: jest.fn(),
  pushSyncedRows: jest.fn(),
  pullSyncedRows: jest.fn(),
  deleteAccount: jest.fn(),
  signOut: jest.fn(),
}));

const A = { id: 'user-a', email: 'a@example.test' };
const B = { id: 'user-b', email: 'b@example.test' };
const OFFLINE = 'Could not reach the server. Check your connection and try again.';
const at = (t) => new Date(t).getTime();

let db;
beforeEach(async () => {
  db = await openMigratedTestDatabase();
  signedInAccount.mockReset();
  signedInAccount.mockResolvedValue(A);
  pushSyncedRows.mockReset();
  pushSyncedRows.mockResolvedValue([]);
  pullSyncedRows.mockReset();
  pullSyncedRows.mockResolvedValue([]);
  deleteAccount.mockReset();
  deleteAccount.mockResolvedValue();
  signOut.mockReset();
  signOut.mockResolvedValue();
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  db.close();
});

const pushedTables = () => pushSyncedRows.mock.calls.map(([table]) => table);

describe('batches', () => {
  it('splits rows into lists of at most the size, in order', () => {
    expect(batches([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('gives no lists for no rows', () => {
    expect(batches([], 2)).toEqual([]);
  });
});

describe('syncNow', () => {
  it('pushes and pulls nothing while signed out, and keeps the rows waiting', async () => {
    await vehicles.add(db, { name: 'My Myvi' });
    signedInAccount.mockResolvedValue(null);

    expect(await syncNow(db)).toEqual({ status: 'signed out' });
    expect(pushSyncedRows).not.toHaveBeenCalled();
    expect(pullSyncedRows).not.toHaveBeenCalled();
    expect(await syncState.get(db)).toMatchObject({ account: null, pending: 1 });
  });

  it('pulls every table while signed in, even with nothing to push', async () => {
    expect(await syncNow(db)).toEqual({ status: 'synced', refused: [], pulled: 0 });
    expect(pushSyncedRows).not.toHaveBeenCalled();
    expect(pullSyncedRows.mock.calls.map(([table]) => table)).toEqual([
      'vehicle',
      'place',
      'place_rate',
      'public_holiday',
      'parking_session',
    ]);
    // The first pull reads from the beginning.
    expect(pullSyncedRows.mock.calls[0][1]).toEqual({ afterUs: null, afterId: null, limit: PULL_PAGE });
  });

  it('asks for the next page after the last row of a full one, and the next pull from a minute back', async () => {
    const page = Array.from({ length: PULL_PAGE }, (_, i) => ({
      id: `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`,
      name: `Car ${i}`,
      is_default: false,
      archived: false,
      created_at: i,
      updated_at: i,
      deleted_at: null,
      server_updated_us: 5000000000 + i,
    }));
    pullSyncedRows.mockImplementation(async (table, { afterId }) => (table === 'vehicle' && afterId == null ? page : []));

    await syncNow(db);
    const vehicleCalls = pullSyncedRows.mock.calls.filter(([table]) => table === 'vehicle');
    expect(vehicleCalls[1][1]).toMatchObject({ afterUs: 5000000000 + PULL_PAGE - 1, afterId: page.at(-1).id });

    pullSyncedRows.mockClear();
    await syncNow(db);
    expect(pullSyncedRows.mock.calls[0][1]).toMatchObject({
      afterUs: 5000000000 + PULL_PAGE - 1 - PULL_OVERLAP_US,
      afterId: null,
    });
  });

  it('tells the screens once the sync is done, only when the pull changed something', async () => {
    // What a screen reloading at that moment would read.
    const seen = [];
    const stop = onPulledChange(() => seen.push(syncState.get(db)));
    const car = { id: 'v', name: 'My Myvi', is_default: true, archived: false, created_at: 1, updated_at: 1 };
    pullSyncedRows.mockImplementation(async (table) => (table === 'vehicle' ? [{ ...car, server_updated_us: 9 }] : []));

    await syncNow(db);
    await syncNow(db);
    stop();

    expect(seen).toHaveLength(1);
    expect((await seen[0]).lastSyncedAt).not.toBeNull();
  });

  it('writes nothing from a pull that fails part of the way', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    pullSyncedRows.mockImplementation(async (table) => {
      if (table === 'place') throw new Error(OFFLINE);
      return table === 'vehicle'
        ? [{ id: 'v', name: 'My Myvi', is_default: true, archived: false, created_at: 1, updated_at: 1, server_updated_us: 9 }]
        : [];
    });

    expect((await syncNow(db)).status).toBe('failed');
    expect(await vehicles.list(db)).toEqual([]);
    expect(await syncState.get(db)).toMatchObject({ lastError: OFFLINE });
  });

  it('backs the phone up to the first account that signs in, parents first', async () => {
    const vehicleId = await vehicles.add(db, { name: 'My Myvi' });
    await places.create(db, { name: 'Mid Valley' });
    await holidays.add(db, { holiday_date: '2026-12-25' });
    await sessions.start(db, {
      vehicle_id: vehicleId,
      level: 'B2',
      bay: 'C14',
      place_name: 'Sunway Pyramid',
      rates: { weekday: { type: 'flat', flat_sen: 500 } },
      save_rates: ['weekday'],
    });

    expect(await syncNow(db)).toEqual({ status: 'synced', refused: [], pulled: 0 });
    expect(pushedTables()).toEqual(['vehicle', 'place', 'place_rate', 'public_holiday', 'parking_session']);
    expect(pushSyncedRows.mock.calls[0][1]).toEqual([expect.objectContaining({ id: vehicleId, is_default: true })]);
    expect(pushSyncedRows.mock.calls[0][1][0]).not.toHaveProperty('dirty');
    expect(await syncState.get(db)).toMatchObject({ account: A, owner: A, pending: 0, lastError: null });
  });

  it('does not give this phone\'s rows to another person\'s account', async () => {
    await syncState.setOwner(db, A);
    await vehicles.add(db, { name: 'My Myvi' });
    signedInAccount.mockResolvedValue(B);

    expect(await syncNow(db)).toEqual({ status: 'other account' });
    expect(pushSyncedRows).not.toHaveBeenCalled();
    expect(await syncState.get(db)).toMatchObject({ account: B, owner: A, otherAccount: true, pending: 1 });
  });

  it('pushes everything again to an account made again with the same email', async () => {
    await vehicles.add(db, { name: 'My Myvi' });
    await syncNow(db);
    pushSyncedRows.mockClear();
    // Deleted elsewhere and signed up again: the server lost the phone's rows.
    const recreated = { id: 'user-a2', email: A.email };
    signedInAccount.mockResolvedValue(recreated);
    await syncState.setAccount(db, recreated);

    expect((await syncNow(db)).status).toBe('synced');
    expect(pushedTables()).toEqual(['vehicle']);
    expect(await syncState.get(db)).toMatchObject({ owner: recreated, pending: 0 });
  });

  it('keeps the new email of the same account', async () => {
    await syncState.setOwner(db, A);
    await vehicles.add(db, { name: 'My Myvi' });
    signedInAccount.mockResolvedValue({ ...A, email: 'new@example.test' });

    await syncNow(db);

    expect((await syncState.get(db)).owner).toEqual({ ...A, email: 'new@example.test' });
  });

  it('keeps a refused row waiting and remembers why, while the rest is pushed', async () => {
    const vehicleId = await vehicles.add(db, { name: 'My Myvi' });
    const sessionId = await sessions.start(db, { vehicle_id: vehicleId, level: 'B2', bay: 'C14' });
    const refusal = {
      id: sessionId,
      code: '23505',
      constraint: 'one_active_session_per_vehicle',
      other: { id: 'elsewhere', level: 'L3', bay: null, started_at: at('2026-10-27T09:00') },
    };
    pushSyncedRows.mockImplementation(async (table) => (table === 'parking_session' ? [refusal] : []));

    const result = await syncNow(db);

    expect(result.status).toBe('synced');
    expect(result.refused).toEqual([expect.objectContaining({ table: 'parking_session', ...refusal })]);
    expect(await syncState.get(db)).toMatchObject({ pending: 1 });
    expect(await syncState.refusedSession(db, sessionId)).toMatchObject({ ...refusal, vehicle_name: 'My Myvi' });
  });

  it('keeps the rows waiting and the error when the server cannot be reached', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    await vehicles.add(db, { name: 'My Myvi' });
    pushSyncedRows.mockRejectedValue(new Error(OFFLINE));

    expect((await syncNow(db)).status).toBe('failed');
    expect(await syncState.get(db)).toMatchObject({ pending: 1, lastError: OFFLINE });
  });

  it('keeps a sentence, not the database\'s own text, when the phone itself fails', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    await vehicles.add(db, { name: 'My Myvi' });
    await db.execAsync('DROP TABLE public_holiday');

    expect((await syncNow(db)).status).toBe('failed');
    expect(await settings.get(db, 'sync_last_error')).toBe(LOCAL_SYNC_ERROR_TEXT);
  });

  it('gives up on a call that hangs, so the next sync can run', async () => {
    jest.useFakeTimers();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    await vehicles.add(db, { name: 'My Myvi' });
    pushSyncedRows.mockReturnValue(new Promise(() => {}));

    const syncing = syncNow(db);
    await jest.advanceTimersByTimeAsync(CALL_TIMEOUT_MS);

    expect((await syncing).status).toBe('failed');
    expect(await syncState.get(db)).toMatchObject({ pending: 1, lastError: TIMED_OUT_TEXT });
  });

  it('pushes a long table in several calls', async () => {
    const day = at('2026-01-01T12:00');
    for (let i = 0; i <= PUSH_BATCH; i++) {
      const date = new Date(day + i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      await holidays.add(db, { holiday_date: date });
    }

    await syncNow(db);

    expect(pushSyncedRows.mock.calls.map(([, rows]) => rows.length)).toEqual([PUSH_BATCH, 1]);
    expect(await syncRows.countDirty(db)).toBe(0);
  });

  it('runs once more when asked during a push, so a change made then is not left waiting', async () => {
    const now = jest.spyOn(Date, 'now');
    now.mockReturnValue(at('2026-10-27T10:00'));
    const id = await vehicles.add(db, { name: 'My Myvi' });
    let second;
    pushSyncedRows.mockImplementationOnce(async () => {
      now.mockReturnValue(at('2026-10-27T10:01'));
      await vehicles.rename(db, id, 'Our Myvi');
      second = syncNow(db);
      return [];
    });

    const first = await syncNow(db);

    expect(await second).toBe(first);
    expect(pushSyncedRows).toHaveBeenCalledTimes(2);
    expect(pushSyncedRows.mock.calls[1][1]).toEqual([expect.objectContaining({ name: 'Our Myvi' })]);
    expect(await syncRows.countDirty(db)).toBe(0);
  });
});

describe('pushBeforeSignOut', () => {
  it('pushes without pulling, then says nothing is left behind', async () => {
    await vehicles.add(db, { name: 'My Myvi' });

    expect(await pushBeforeSignOut(db)).toBe(0);
    expect(pushedTables()).toEqual(['vehicle']);
    expect(pullSyncedRows).not.toHaveBeenCalled();
  });

  it('makes no call at all when nothing waits to be pushed', async () => {
    expect(await pushBeforeSignOut(db)).toBe(0);
    expect(signedInAccount).not.toHaveBeenCalled();
  });

  it('counts what could not be pushed', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    await vehicles.add(db, { name: 'My Myvi' });
    await places.create(db, { name: 'Mid Valley' });
    pushSyncedRows.mockRejectedValue(new Error(OFFLINE));

    expect(await pushBeforeSignOut(db)).toBe(2);
  });

  it('waits no longer than SIGN_OUT_WAIT_MS for a push that hangs', async () => {
    jest.useFakeTimers();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    await vehicles.add(db, { name: 'My Myvi' });
    pushSyncedRows.mockReturnValue(new Promise(() => {}));

    const asking = pushBeforeSignOut(db);
    await jest.advanceTimersByTimeAsync(SIGN_OUT_WAIT_MS);

    expect(await asking).toBe(1);
    // The hung call then gives up, and the sync ends.
    await jest.advanceTimersByTimeAsync(CALL_TIMEOUT_MS);
  });

  it('leaves out rows that belong to another person\'s account', async () => {
    await syncState.setOwner(db, A);
    await vehicles.add(db, { name: 'My Myvi' });
    signedInAccount.mockResolvedValue(B);

    expect(await pushBeforeSignOut(db)).toBe(0);
  });
});

describe('loadAccount', () => {
  it('keeps the account on the phone for Settings', async () => {
    expect(await loadAccount(db)).toEqual(A);
    expect((await syncState.get(db)).account).toEqual(A);
  });
});

describe('signOutKeepingData', () => {
  it('forgets the account but keeps the rows and who they are backed up to', async () => {
    await vehicles.add(db, { name: 'My Myvi' });
    await syncNow(db);

    await signOutKeepingData(db);

    expect(await syncState.get(db)).toMatchObject({ account: null, owner: A });
    expect(await vehicles.list(db)).toHaveLength(1);
  });

  it('gives up on a sign-out that hangs, and the user stays signed in', async () => {
    jest.useFakeTimers();
    await syncState.setAccount(db, A);
    signOut.mockReturnValue(new Promise(() => {}));

    const leaving = signOutKeepingData(db);
    const failed = expect(leaving).rejects.toThrow(SIGN_OUT_TIMED_OUT_TEXT);
    await jest.advanceTimersByTimeAsync(CALL_TIMEOUT_MS);

    await failed;
    expect((await syncState.get(db)).account).toEqual(A);
  });
});

describe('errorTextFor', () => {
  it('gives the server\'s sentence, and a plain one for the phone\'s own database', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    signOut.mockRejectedValue(new Error(OFFLINE));
    const serverError = await signOutKeepingData(db).catch((e) => e);

    expect(errorTextFor(serverError)).toBe(OFFLINE);
    expect(errorTextFor(new Error('Error code 5: database is locked'))).toBe(LOCAL_SYNC_ERROR_TEXT);
  });
});

describe('deleteAccountAndForget', () => {
  it('gives up on a deletion that hangs, and leaves the phone as it was', async () => {
    jest.useFakeTimers();
    await syncState.setOwner(db, A);
    deleteAccount.mockReturnValue(new Promise(() => {}));

    const deleting = deleteAccountAndForget(db);
    const failed = expect(deleting).rejects.toThrow(DELETE_TIMED_OUT_TEXT);
    await jest.advanceTimersByTimeAsync(DELETE_TIMEOUT_MS);

    await failed;
    expect((await syncState.get(db)).owner).toEqual(A);
  });

  it('waits for a push in progress, so it cannot mark rows pushed after the reset', async () => {
    await vehicles.add(db, { name: 'My Myvi' });
    let finishPush;
    pushSyncedRows.mockReturnValue(new Promise((resolve) => (finishPush = resolve)));
    const syncing = syncNow(db);
    await new Promise((resolve) => setImmediate(resolve));

    const deleting = deleteAccountAndForget(db);
    await new Promise((resolve) => setImmediate(resolve));
    expect(deleteAccount).not.toHaveBeenCalled();
    finishPush([]);
    await syncing;

    expect(await deleting).toEqual({ localError: null });
    expect(await syncState.get(db)).toMatchObject({ owner: null, pending: 1 });
  });

  it('leaves every row for the next account once the server has deleted the account', async () => {
    await vehicles.add(db, { name: 'My Myvi' });
    await syncNow(db);

    expect(await deleteAccountAndForget(db)).toEqual({ localError: null });
    expect(await syncState.get(db)).toMatchObject({ account: null, owner: null, pending: 1 });
  });

  it('changes nothing on the phone when the server refuses', async () => {
    await vehicles.add(db, { name: 'My Myvi' });
    await syncNow(db);
    deleteAccount.mockRejectedValue(new Error(OFFLINE));

    await expect(deleteAccountAndForget(db)).rejects.toThrow(OFFLINE);
    expect(await syncState.get(db)).toMatchObject({ account: A, owner: A, pending: 0 });
  });
});

describe('addPhoneDataToAccount', () => {
  it('pushes every row to the account signed in, and pulls it from the beginning', async () => {
    await vehicles.add(db, { name: 'My Myvi' });
    await syncNow(db);
    await settings.set(db, 'sync_pulled_vehicle', '5000000000');
    pushSyncedRows.mockClear();
    pullSyncedRows.mockClear();
    signedInAccount.mockResolvedValue(B);
    await syncState.setAccount(db, B);

    expect((await addPhoneDataToAccount(db)).status).toBe('synced');
    expect(pushedTables()).toEqual(['vehicle']);
    expect(pullSyncedRows.mock.calls[0][1]).toEqual({ afterUs: null, afterId: null, limit: PULL_PAGE });
    expect(await syncState.get(db)).toMatchObject({ account: B, owner: B, otherAccount: false, pending: 0 });
  });

  it('waits for a push in progress, so it cannot mark rows pushed after the reset', async () => {
    await vehicles.add(db, { name: 'My Myvi' });
    let finishPush;
    pushSyncedRows.mockReturnValueOnce(new Promise((resolve) => (finishPush = resolve)));
    const syncing = syncNow(db);
    await new Promise((resolve) => setImmediate(resolve));
    signedInAccount.mockResolvedValue(B);
    await syncState.setAccount(db, B);

    const adding = addPhoneDataToAccount(db);
    await new Promise((resolve) => setImmediate(resolve));
    finishPush([]);
    await syncing;

    expect((await adding).status).toBe('synced');
    // Once to A as the push in progress ends, then again to B.
    expect(pushedTables()).toEqual(['vehicle', 'vehicle']);
    expect(await syncState.get(db)).toMatchObject({ owner: B, pending: 0 });
  });

  it('only syncs when the phone is already backed up to the account signed in', async () => {
    await vehicles.add(db, { name: 'My Myvi' });
    await syncNow(db);
    pushSyncedRows.mockClear();

    expect((await addPhoneDataToAccount(db)).status).toBe('synced');
    expect(pushSyncedRows).not.toHaveBeenCalled();
    expect(await syncState.get(db)).toMatchObject({ owner: A, pending: 0 });
  });
});
