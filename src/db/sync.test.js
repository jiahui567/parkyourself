import { openMigratedTestDatabase } from '../../test/testDatabase';
import { onSyncedChange } from './core';
import { holidays } from './holidays';
import { placeRates, places } from './places';
import { sessions } from './sessions';
import { accountMatch, SYNCED_TABLES, syncRows, syncState, toServerRow } from './sync';
import { vehicles } from './vehicles';

const at = (t) => new Date(t).getTime();

let db;
beforeEach(async () => {
  db = await openMigratedTestDatabase();
});
afterEach(() => {
  jest.restoreAllMocks();
  db.close();
});

const dirtyOf = async (table, id) => (await db.getFirstAsync(`SELECT dirty FROM ${table} WHERE id = ?`, [id])).dirty;

// Marks every row of every table pushed, as a sync that went through would.
async function pushEverything() {
  for (const table of SYNCED_TABLES) await syncRows.markPushed(db, table, await syncRows.listDirty(db, table));
}

describe('dirty', () => {
  it('starts at 1 on a new row', async () => {
    const id = await vehicles.add(db, { name: 'My Myvi' });

    expect(await dirtyOf('vehicle', id)).toBe(1);
  });

  it('goes back to 1 when a pushed row changes', async () => {
    const id = await vehicles.add(db, { name: 'My Myvi' });
    await pushEverything();
    expect(await dirtyOf('vehicle', id)).toBe(0);

    await vehicles.rename(db, id, 'Our Myvi');

    expect(await dirtyOf('vehicle', id)).toBe(1);
  });

  it('goes back to 1 when a pushed row is deleted', async () => {
    const id = await places.create(db, { name: 'Mid Valley' });
    await pushEverything();

    await places.remove(db, id);

    expect(await dirtyOf('place', id)).toBe(1);
  });

  it('marks the rates of a deleted place too', async () => {
    const placeId = await places.create(db, { name: 'Mid Valley' });
    const rateId = await placeRates.create(db, { place_id: placeId, day_type: 'weekday', type: 'flat', flat_sen: 500 });
    await pushEverything();

    await places.remove(db, placeId);

    expect(await dirtyOf('place_rate', rateId)).toBe(1);
  });

  it('marks the car that stops being the default too', async () => {
    const first = await vehicles.add(db, { name: 'My Myvi' });
    const second = await vehicles.add(db, { name: 'My Axia' });
    await pushEverything();

    await vehicles.setDefault(db, second);

    expect(await dirtyOf('vehicle', first)).toBe(1);
  });
});

describe('onSyncedChange', () => {
  it('tells listeners about inserts, updates and deletes, until they stop listening', async () => {
    const listener = jest.fn();
    const stop = onSyncedChange(listener);

    const id = await vehicles.add(db, { name: 'My Myvi' });
    await vehicles.rename(db, id, 'Our Myvi');
    await vehicles.remove(db, id);
    stop();
    await vehicles.add(db, { name: 'My Axia' });

    expect(listener).toHaveBeenCalledTimes(3);
  });

  it('says nothing when nothing changed', async () => {
    const listener = jest.fn();
    const stop = onSyncedChange(listener);

    await vehicles.update(db, 'no-such-id', { name: 'Ghost' });
    stop();

    expect(listener).not.toHaveBeenCalled();
  });
});

describe('syncRows', () => {
  it('lists dirty rows oldest change first, deleted ones included', async () => {
    const now = jest.spyOn(Date, 'now');
    now.mockReturnValue(at('2026-10-27T10:00'));
    const later = await places.create(db, { name: 'Sunway Pyramid' });
    now.mockReturnValue(at('2026-10-27T09:00'));
    const earlier = await places.create(db, { name: 'Mid Valley' });
    now.mockReturnValue(at('2026-10-27T11:00'));
    await places.remove(db, earlier);

    expect((await syncRows.listDirty(db, 'place')).map((row) => row.id)).toEqual([later, earlier]);
  });

  it('leaves a row dirty when it changed after it was read for the push', async () => {
    const now = jest.spyOn(Date, 'now');
    now.mockReturnValue(at('2026-10-27T10:00'));
    const id = await vehicles.add(db, { name: 'My Myvi' });
    const read = await syncRows.listDirty(db, 'vehicle');
    now.mockReturnValue(at('2026-10-27T10:01'));
    await vehicles.rename(db, id, 'Our Myvi');

    await syncRows.markPushed(db, 'vehicle', read);

    expect(await dirtyOf('vehicle', id)).toBe(1);
  });

  it('counts the dirty rows over every synced table', async () => {
    const vehicleId = await vehicles.add(db, { name: 'My Myvi' });
    await holidays.add(db, { holiday_date: '2026-12-25' });
    await pushEverything();
    await vehicles.rename(db, vehicleId, 'Our Myvi');
    await places.create(db, { name: 'Mid Valley' });

    expect(await syncRows.countDirty(db)).toBe(2);
  });

  it('refuses a table that does not sync', () => {
    expect(() => syncRows.listDirty(db, 'photo')).toThrow('Not a synced table: photo');
  });
});

describe('toServerRow', () => {
  it('drops dirty and sends the flags as booleans', () => {
    expect(toServerRow('vehicle', { id: 'v', name: 'My Myvi', is_default: 1, archived: 0, dirty: 1 })).toEqual({
      id: 'v',
      name: 'My Myvi',
      is_default: true,
      archived: false,
    });
  });

  it('sends the rate snapshot as JSON, not as its text', () => {
    const row = toServerRow('parking_session', { id: 's', rate_snapshot: '{"weekday":{"type":"flat","flat_sen":500}}' });

    expect(row.rate_snapshot).toEqual({ weekday: { type: 'flat', flat_sen: 500 } });
  });

  it('keeps a missing rate snapshot null', () => {
    expect(toServerRow('parking_session', { id: 's', rate_snapshot: null }).rate_snapshot).toBeNull();
  });
});

describe('accountMatch', () => {
  const A = { id: 'user-a', email: 'a@example.test' };

  it.each([
    ['first', null, A],
    ['same', A, A],
    ['same', A, { ...A, email: 'new@example.test' }],
    ['recreated', A, { id: 'user-a2', email: 'A@Example.test' }],
    ['other', A, { id: 'user-b', email: 'b@example.test' }],
    ['other', { id: 'user-a', email: null }, { id: 'user-b', email: null }],
  ])('is %s', (match, owner, account) => {
    expect(accountMatch(owner, account)).toBe(match);
  });
});

describe('syncState', () => {
  it('starts with no account and nothing synced', async () => {
    expect(await syncState.get(db)).toEqual({
      account: null,
      owner: null,
      otherAccount: false,
      restarting: false,
      pending: 0,
      lastSyncedAt: null,
      lastError: null,
      refused: [],
    });
  });

  it('says when the account signed in is the owner\'s email made again', async () => {
    await syncState.setOwner(db, { id: 'user-a', email: 'a@example.test' });
    await syncState.setAccount(db, { id: 'user-a2', email: 'a@example.test' });

    expect(await syncState.get(db)).toMatchObject({ otherAccount: false, restarting: true });
  });

  it('keeps the owner when the account signs out', async () => {
    const account = { id: 'user-a', email: 'a@example.test' };
    await syncState.setAccount(db, account);
    await syncState.setOwner(db, account);

    await syncState.setAccount(db, null);

    expect(await syncState.get(db)).toMatchObject({ account: null, owner: account, otherAccount: false });
  });

  it('says when another person\'s account is signed in', async () => {
    await syncState.setOwner(db, { id: 'user-a', email: 'a@example.test' });
    await syncState.setAccount(db, { id: 'user-b', email: 'b@example.test' });

    expect((await syncState.get(db)).otherAccount).toBe(true);
  });

  it('keeps a refusal while its row is unchanged, with the car of a refused session', async () => {
    const vehicleId = await vehicles.add(db, { name: 'My Myvi' });
    const sessionId = await sessions.start(db, { vehicle_id: vehicleId, level: 'B2', bay: 'C14' });
    const [row] = await syncRows.listDirty(db, 'parking_session');
    const refusal = { table: 'parking_session', id: sessionId, updated_at: row.updated_at, code: '23505' };

    await syncState.finished(db, at('2026-10-27T10:00'), [refusal]);

    expect(await syncState.refusedSession(db, sessionId)).toEqual({ ...refusal, vehicle_name: 'My Myvi' });
  });

  it('forgets a refusal once its row has changed, since the change is pushed again', async () => {
    const now = jest.spyOn(Date, 'now');
    now.mockReturnValue(at('2026-10-27T10:00'));
    const id = await places.create(db, { name: 'Mid Valley' });
    await syncState.finished(db, at('2026-10-27T10:00'), [
      { table: 'place', id, updated_at: at('2026-10-27T10:00'), code: '23505' },
    ]);
    now.mockReturnValue(at('2026-10-27T10:05'));

    await places.update(db, id, { note: 'Level B3 is free on Sundays' });

    expect((await syncState.get(db)).refused).toEqual([]);
  });

  it('records a failure until the next push goes through', async () => {
    await syncState.failed(db, 'Could not reach the server.');
    expect((await syncState.get(db)).lastError).toBe('Could not reach the server.');

    await syncState.finished(db, at('2026-10-27T10:00'), []);

    expect(await syncState.get(db)).toMatchObject({ lastError: null, lastSyncedAt: at('2026-10-27T10:00') });
  });

  it('starts over for a new owner: every row waits to be pushed again', async () => {
    await vehicles.add(db, { name: 'My Myvi' });
    await places.create(db, { name: 'Mid Valley' });
    await pushEverything();
    await syncState.setOwner(db, { id: 'user-a', email: 'a@example.test' });
    await syncState.finished(db, at('2026-10-27T10:00'), []);
    const recreated = { id: 'user-a2', email: 'a@example.test' };

    await syncState.startOver(db, recreated);

    expect(await syncState.get(db)).toMatchObject({ owner: recreated, pending: 2, lastSyncedAt: null });
  });

  it('after the account is deleted, signs out and leaves every row for the next account', async () => {
    await vehicles.add(db, { name: 'My Myvi' });
    await places.create(db, { name: 'Mid Valley' });
    await pushEverything();
    const account = { id: 'user-a', email: 'a@example.test' };
    await syncState.setAccount(db, account);
    await syncState.setOwner(db, account);
    await syncState.finished(db, at('2026-10-27T10:00'), []);

    await syncState.afterAccountDeleted(db);

    expect(await syncState.get(db)).toEqual({
      account: null,
      owner: null,
      otherAccount: false,
      restarting: false,
      pending: 2,
      lastSyncedAt: null,
      lastError: null,
      refused: [],
    });
  });

  it('keeps the rows with their own account when another person deleted theirs', async () => {
    await vehicles.add(db, { name: 'My Myvi' });
    await pushEverything();
    const owner = { id: 'user-a', email: 'a@example.test' };
    await syncState.setOwner(db, owner);
    await syncState.setAccount(db, { id: 'user-b', email: 'b@example.test' });

    await syncState.afterAccountDeleted(db);

    expect(await syncState.get(db)).toMatchObject({ account: null, owner, pending: 0 });
  });
});
