import { openMigratedTestDatabase } from '../../test/testDatabase';
import { holidays } from './holidays';
import { deletePhotoFiles } from './photos';
import { placeRates, places } from './places';
import { fromServerRow, onPulledChange, placeLastChange, syncPull, WRITE_CHUNK } from './pull';
import { sessions } from './sessions';
import { SYNCED_TABLES, syncRows, syncState } from './sync';
import { vehicles } from './vehicles';

// The image files need the phone's file system (src/db/selfTest.js checks
// them); here, which files the pull deletes, and when.
jest.mock('./photos', () => ({ ...jest.requireActual('./photos'), deletePhotoFiles: jest.fn() }));

const at = (t) => new Date(t).getTime();
const EARLY = at('2026-10-27T09:00');
const PILLAR = 'file:///photos/pillar.jpg';
const LIFT = 'file:///photos/lift.jpg';

// Rows as pull_synced_rows sends them, each stamped later than the last.
let stamp = 1000000;
const server = (row) => ({
  deleted_at: null,
  created_at: EARLY,
  updated_at: EARLY,
  ...row,
  server_updated_us: ++stamp,
});
const car = (id, name, extra = {}) =>
  server({ id, name, colour: null, is_default: false, archived: false, merged_into: null, ...extra });
const place = (id, name, extra = {}) =>
  server({ id, name, note: null, lat: null, lng: null, last_used_at: null, merged_into: null, ...extra });
const rate = (id, placeId, dayType, flatSen, extra = {}) =>
  server({
    id,
    place_id: placeId,
    day_type: dayType,
    type: 'flat',
    first_minutes: null,
    first_sen: null,
    block_minutes: null,
    block_sen: null,
    grace_minutes: 0,
    daily_cap_sen: null,
    flat_sen: flatSen,
    ...extra,
  });
const holiday = (id, date, name, extra = {}) => server({ id, holiday_date: date, name, ...extra });
const session = (id, vehicleId, extra = {}) =>
  server({ id, vehicle_id: vehicleId, place_id: null, status: 'active', started_at: EARLY, level: 'L3', bay: 'C14', ...extra });

let db;
let clock;
beforeEach(async () => {
  db = await openMigratedTestDatabase();
  clock = jest.spyOn(Date, 'now');
  clock.mockReturnValue(at('2026-10-27T10:00'));
  deletePhotoFiles.mockReset();
});
afterEach(() => {
  jest.restoreAllMocks();
  db.close();
});

const row = (table, id) => db.getFirstAsync(`SELECT * FROM ${table} WHERE id = ?`, [id]);

// As a sync that went through: every row on the phone is on the server.
async function pushEverything() {
  for (const table of SYNCED_TABLES) await syncRows.markPushed(db, table, await syncRows.listDirty(db, table));
}

describe('fromServerRow', () => {
  it('turns booleans into 0/1 and JSON into text, and leaves out columns the phone does not have', () => {
    expect(
      fromServerRow({ id: 'v', is_default: true, archived: false, wheels: 4, rate_snapshot: { weekday: null } }, [
        'id',
        'is_default',
        'archived',
        'rate_snapshot',
        'name',
      ])
    ).toEqual({ id: 'v', is_default: 1, archived: 0, rate_snapshot: '{"weekday":null}' });
  });
});

describe('placeLastChange', () => {
  it('is the latest of the place and its rates', () => {
    expect(placeLastChange({ updated_at: 5 }, [{ updated_at: 9 }, { updated_at: 3 }])).toBe(9);
    expect(placeLastChange({ updated_at: 5 }, [])).toBe(5);
  });
});

describe('syncPull.apply', () => {
  it('stores a new row as the server has it, not waiting to be pushed', async () => {
    await syncPull.apply(db, { vehicle: [car('v1', 'My Myvi', { is_default: true })] });

    expect(await row('vehicle', 'v1')).toMatchObject({ name: 'My Myvi', is_default: 1, dirty: 0 });
  });

  it('stores the rate snapshot as text, and another phone\'s session as not parked here', async () => {
    await syncPull.apply(db, {
      vehicle: [car('v1', 'My Myvi')],
      parking_session: [session('s1', 'v1', { rate_snapshot: { weekday: { type: 'flat', flat_sen: 500 } } })],
    });

    expect(await row('parking_session', 's1')).toMatchObject({
      rate_snapshot: '{"weekday":{"type":"flat","flat_sen":500}}',
      parked_here: 0,
      dirty: 0,
    });
  });

  it('keeps a session parked here as parked here when another phone changes it', async () => {
    const vehicleId = await vehicles.add(db, { name: 'My Myvi' });
    const id = await sessions.start(db, { vehicle_id: vehicleId, level: 'B2' });
    await pushEverything();
    const local = await row('parking_session', id);

    await syncPull.apply(db, {
      parking_session: [session(id, vehicleId, { started_at: local.started_at, level: 'B1', updated_at: local.updated_at + 1 })],
    });

    expect(await row('parking_session', id)).toMatchObject({ level: 'B1', parked_here: 1, dirty: 0 });
  });

  it('keeps the phone\'s own newer change, which is pushed next', async () => {
    const id = await vehicles.add(db, { name: 'My Myvi' });
    clock.mockReturnValue(at('2026-10-27T10:05'));
    await vehicles.rename(db, id, 'Our Myvi');

    await syncPull.apply(db, { vehicle: [car(id, 'Their Myvi', { updated_at: at('2026-10-27T10:01') })] });

    expect(await row('vehicle', id)).toMatchObject({ name: 'Our Myvi', dirty: 1 });
  });

  it('takes the server\'s newer change over an older one made here (last write wins)', async () => {
    const id = await vehicles.add(db, { name: 'My Myvi' });

    await syncPull.apply(db, { vehicle: [car(id, 'Their Myvi', { updated_at: at('2026-10-27T10:05') })] });

    expect(await row('vehicle', id)).toMatchObject({ name: 'Their Myvi', dirty: 0 });
  });

  it('takes a deletion made on another phone', async () => {
    const id = await places.create(db, { name: 'Mid Valley' });
    await pushEverything();

    await syncPull.apply(db, {
      place: [place(id, 'Mid Valley', { updated_at: at('2026-10-27T10:05'), deleted_at: at('2026-10-27T10:05') })],
    });

    expect(await places.get(db, id)).toBeNull();
  });

  it('deletes the photos of a session deleted on another phone, as Delete does here', async () => {
    const carId = await vehicles.add(db, { name: 'My Myvi' });
    const id = await sessions.start(db, { vehicle_id: carId, photo_files: [{ file_uri: PILLAR }, { file_uri: LIFT }] });
    await pushEverything();

    const deleted = at('2026-10-27T10:05');
    await syncPull.apply(db, {
      parking_session: [session(id, carId, { started_at: at('2026-10-27T10:00'), updated_at: deleted, deleted_at: deleted })],
    });

    expect(await sessions.get(db, id)).toBeNull();
    expect(await db.getAllAsync('SELECT * FROM photo')).toEqual([]);
    expect(deletePhotoFiles.mock.calls.flat().flat()).toEqual([PILLAR, LIFT]);
  });

  it('keeps the photo files when the pull that deleted their session is undone', async () => {
    const carId = await vehicles.add(db, { name: 'My Myvi' });
    const id = await sessions.start(db, { vehicle_id: carId, photo_files: [{ file_uri: PILLAR }] });
    await pushEverything();
    const deleted = at('2026-10-27T10:05');
    // A row the phone cannot store fails the transaction after the deletion.
    const broken = session('broken', carId, { status: 'ended', started_at: null });

    await expect(
      syncPull.apply(db, {
        parking_session: [
          session(id, carId, { started_at: at('2026-10-27T10:00'), updated_at: deleted, deleted_at: deleted }),
          broken,
        ],
      })
    ).rejects.toThrow();

    expect(await sessions.get(db, id)).not.toBeNull();
    expect((await db.getAllAsync('SELECT file_uri FROM photo')).map((p) => p.file_uri)).toEqual([PILLAR]);
    expect(deletePhotoFiles.mock.calls.flat().flat()).toEqual([]);
  });

  it('counts a row that came again unchanged as no change', async () => {
    const myvi = car('v1', 'My Myvi');

    expect(await syncPull.apply(db, { vehicle: [myvi] })).toEqual({ changed: 1, dirtied: 0 });
    expect(await syncPull.apply(db, { vehicle: [myvi] })).toEqual({ changed: 0, dirtied: 0 });
  });

  it('leaves telling the screens to the sync, unless it fails after changing rows', async () => {
    const listener = jest.fn();
    const stop = onPulledChange(listener);

    await syncPull.apply(db, { vehicle: [car('v1', 'My Myvi')] });
    expect(listener).not.toHaveBeenCalled();

    // The car is written before the holidays fail.
    await db.execAsync('DROP TABLE public_holiday');
    await expect(
      syncPull.apply(db, { vehicle: [car('v2', 'My Axia')], public_holiday: [holiday('h1', '2026-12-25', null)] })
    ).rejects.toThrow();
    stop();

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('does not hold the cursor back for an older copy of a row whose newer copy is stored', async () => {
    await syncPull.apply(db, { place: [place('p1', 'KLCC')] });
    // First on a place this phone never got, then moved to one it has.
    const before = rate('r1', 'p-gone', 'weekday', 500);
    const after = rate('r1', 'p1', 'weekday', 500, { updated_at: at('2026-10-27T10:30') });

    await syncPull.apply(db, { place_rate: [before, after] });

    expect(await row('place_rate', 'r1')).toMatchObject({ place_id: 'p1' });
    expect(await syncPull.cursor(db, 'place_rate')).toBe(after.server_updated_us);
  });

  it('remembers the latest stamp stored, per table', async () => {
    const first = car('v1', 'My Myvi');
    const second = car('v2', 'My Axia');

    await syncPull.apply(db, { vehicle: [first, second] });

    expect(await syncPull.cursor(db, 'vehicle')).toBe(second.server_updated_us);
    expect(await syncPull.cursor(db, 'place')).toBeNull();
  });

  it('holds back a rate whose place has not arrived, so the next pull asks for it again', async () => {
    const weekday = rate('r1', 'p1', 'weekday', 500);

    await syncPull.apply(db, { place_rate: [weekday] });

    expect(await row('place_rate', 'r1')).toBeNull();
    expect(await syncPull.cursor(db, 'place_rate')).toBe(weekday.server_updated_us - 1);

    await syncPull.apply(db, { place: [place('p1', 'KLCC')], place_rate: [weekday] });

    expect(await row('place_rate', 'r1')).toMatchObject({ place_id: 'p1', flat_sen: 500 });
  });

  it('never goes back to an older copy of a row the phone has from the server', async () => {
    const renamed = place('p1', 'KLCC', { updated_at: at('2026-10-27T10:30') });
    await syncPull.apply(db, { place: [renamed] });

    await syncPull.apply(db, { place: [place('p1', 'Pavilion', { updated_at: at('2026-10-27T10:00') })] });

    expect(await row('place', 'p1')).toMatchObject({ name: 'KLCC' });
  });

  it('does not merge with an older copy of a row whose newer copy came later in the same pull', async () => {
    // Renamed on the server between two pages: both copies come.
    const localId = await places.create(db, { name: 'Pavilion' });
    const before = place('p1', 'Pavilion', { updated_at: at('2026-10-27T09:30') });
    const after = place('p1', 'KLCC', { updated_at: at('2026-10-27T10:30') });

    await syncPull.apply(db, { place: [before, after] });

    expect(await row('place', 'p1')).toMatchObject({ name: 'KLCC', deleted_at: null, merged_into: null });
    expect(await row('place', localId)).toMatchObject({ name: 'Pavilion', deleted_at: null, merged_into: null });
  });

  it('writes a long pull in several short transactions, and moves the cursor once all is written', async () => {
    const dateAfter = (days) => new Date(Date.UTC(2027, 0, 1) + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const many = Array.from({ length: WRITE_CHUNK + 1 }, (_, i) => holiday(`h${i}`, dateAfter(i), null));
    const begun = jest.spyOn(db, 'withExclusiveTransactionAsync');

    await syncPull.apply(db, { public_holiday: many });

    // Two chunks, then the cursor, then settling the merges.
    expect(begun).toHaveBeenCalledTimes(4);
    expect(await syncPull.cursor(db, 'public_holiday')).toBe(many.at(-1).server_updated_us);
  });

  it('starts every table again from the beginning for a new account', async () => {
    await syncPull.apply(db, { vehicle: [car('v1', 'My Myvi')] });

    await syncState.startOver(db, null);

    expect(await syncPull.cursor(db, 'vehicle')).toBeNull();
  });
});

describe('two places with one name', () => {
  it('keeps the server\'s place when it changed last, and moves this phone\'s rates and sessions to it', async () => {
    const localId = await places.create(db, { name: 'Pavilion' });
    const rateId = await placeRates.create(db, { place_id: localId, day_type: 'weekday', type: 'flat', flat_sen: 300 });
    const vehicleId = await vehicles.add(db, { name: 'My Myvi' });
    const sessionId = await sessions.start(db, { vehicle_id: vehicleId, place_name: 'Pavilion' });
    clock.mockReturnValue(at('2026-10-27T11:00'));

    const result = await syncPull.apply(db, {
      place: [place('p-server', 'pavilion', { updated_at: at('2026-10-27T10:30') })],
    });

    expect(await row('place', localId)).toMatchObject({ merged_into: 'p-server', dirty: 1 });
    expect((await row('place', localId)).deleted_at).not.toBeNull();
    expect(await row('place', 'p-server')).toMatchObject({ deleted_at: null, dirty: 0 });
    expect(await row('place_rate', rateId)).toMatchObject({ place_id: 'p-server', deleted_at: null, dirty: 1 });
    expect(await row('parking_session', sessionId)).toMatchObject({ place_id: 'p-server', dirty: 1 });
    expect(result.dirtied).toBeGreaterThan(0);
  });

  it('keeps this phone\'s place when its rate changed last, and the newer rate wins', async () => {
    const localId = await places.create(db, { name: 'Pavilion' });
    const rateId = await placeRates.create(db, { place_id: localId, day_type: 'weekday', type: 'flat', flat_sen: 300 });
    clock.mockReturnValue(at('2026-10-27T10:40'));
    await placeRates.update(db, rateId, { flat_sen: 400 });
    clock.mockReturnValue(at('2026-10-27T11:00'));

    await syncPull.apply(db, {
      place: [place('p-server', 'Pavilion', { updated_at: at('2026-10-27T10:30') })],
      place_rate: [rate('r-server', 'p-server', 'weekday', 500, { updated_at: at('2026-10-27T10:20') })],
    });

    expect(await row('place', localId)).toMatchObject({ deleted_at: null, merged_into: null });
    expect(await row('place', 'p-server')).toMatchObject({ merged_into: localId, dirty: 1 });
    expect((await row('place', 'p-server')).deleted_at).not.toBeNull();
    expect((await places.getRates(db, localId)).weekday).toMatchObject({ id: rateId, flat_sen: 400 });
    expect((await row('place_rate', 'r-server')).deleted_at).not.toBeNull();
  });

  it('does not merge when a later row of the same pull frees the name', async () => {
    const localId = await places.create(db, { name: 'Pavilion' });
    await pushEverything();
    const renamed = place(localId, 'Pavilion KL', { updated_at: at('2026-10-27T10:30') });
    const taken = place('p-new', 'Pavilion', { updated_at: at('2026-10-27T10:30') });

    await syncPull.apply(db, { place: [taken, renamed] });

    expect(await row('place', localId)).toMatchObject({ name: 'Pavilion KL', deleted_at: null, merged_into: null });
    expect(await row('place', 'p-new')).toMatchObject({ name: 'Pavilion', deleted_at: null, dirty: 0 });
  });

  it('moves the rates and sessions of a place another phone merged away', async () => {
    const goneId = await places.create(db, { name: 'Pavilion' });
    const oldRateId = await placeRates.create(db, { place_id: goneId, day_type: 'weekday', type: 'flat', flat_sen: 300 });
    const vehicleId = await vehicles.add(db, { name: 'My Myvi' });
    const sessionId = await sessions.start(db, { vehicle_id: vehicleId, place_name: 'Pavilion' });
    await pushEverything();
    clock.mockReturnValue(at('2026-10-27T11:00'));

    await syncPull.apply(db, {
      place: [
        place(goneId, 'Pavilion', { updated_at: at('2026-10-27T10:30'), deleted_at: at('2026-10-27T10:30'), merged_into: 'p-kept' }),
        place('p-kept', 'Pavilion'),
      ],
      place_rate: [rate('r-kept', 'p-kept', 'weekday', 500, { updated_at: at('2026-10-27T10:20') })],
    });

    expect(await row('parking_session', sessionId)).toMatchObject({ place_id: 'p-kept', dirty: 1 });
    expect((await row('place_rate', oldRateId)).deleted_at).not.toBeNull();
    expect((await places.getRates(db, 'p-kept')).weekday).toMatchObject({ id: 'r-kept', flat_sen: 500 });
  });
});

describe('two live rates for one place and day type', () => {
  it('keeps the newer', async () => {
    const placeId = await places.create(db, { name: 'Mid Valley' });
    await pushEverything();
    const localRate = await placeRates.create(db, { place_id: placeId, day_type: 'weekday', type: 'flat', flat_sen: 300 });

    await syncPull.apply(db, {
      place_rate: [rate('r-server', placeId, 'weekday', 500, { updated_at: at('2026-10-27T10:30') })],
    });

    expect((await row('place_rate', localRate)).deleted_at).not.toBeNull();
    expect((await places.getRates(db, placeId)).weekday).toMatchObject({ id: 'r-server', flat_sen: 500 });
  });

  it('keeps this phone\'s when it is newer, and deletes the server\'s at the next push', async () => {
    const placeId = await places.create(db, { name: 'Mid Valley' });
    await pushEverything();
    clock.mockReturnValue(at('2026-10-27T10:45'));
    const localRate = await placeRates.create(db, { place_id: placeId, day_type: 'weekday', type: 'flat', flat_sen: 300 });

    await syncPull.apply(db, {
      place_rate: [rate('r-server', placeId, 'weekday', 500, { updated_at: at('2026-10-27T10:30') })],
    });

    expect((await places.getRates(db, placeId)).weekday).toMatchObject({ id: localRate, flat_sen: 300 });
    expect(await row('place_rate', 'r-server')).toMatchObject({ dirty: 1 });
    expect((await row('place_rate', 'r-server')).deleted_at).not.toBeNull();
  });
});

describe('the same holiday twice', () => {
  it('keeps the older row, with the other\'s name when it has none', async () => {
    const localId = await holidays.add(db, { holiday_date: '2026-12-25' });

    await syncPull.apply(db, {
      public_holiday: [holiday('h-server', '2026-12-25', 'Christmas', { created_at: at('2026-10-27T11:00') })],
    });

    expect(await row('public_holiday', localId)).toMatchObject({ deleted_at: null, name: 'Christmas', dirty: 1 });
    expect((await row('public_holiday', 'h-server')).deleted_at).not.toBeNull();
  });

  it('keeps the server\'s row when it is older', async () => {
    const localId = await holidays.add(db, { holiday_date: '2026-12-25', name: 'Christmas Day' });

    await syncPull.apply(db, { public_holiday: [holiday('h-server', '2026-12-25', null)] });

    expect((await row('public_holiday', localId)).deleted_at).not.toBeNull();
    expect(await holidays.list(db)).toEqual([expect.objectContaining({ id: 'h-server', name: 'Christmas Day' })]);
  });
});

describe('a car parked on two phones', () => {
  it('holds back the other phone\'s session until this one ends, and never merges them', async () => {
    const vehicleId = await vehicles.add(db, { name: 'My Myvi' });
    await pushEverything();
    const here = await sessions.start(db, { vehicle_id: vehicleId, level: 'B2' });
    const there = session('s-there', vehicleId, { level: 'L3' });

    await syncPull.apply(db, { parking_session: [there] });

    expect(await row('parking_session', 's-there')).toBeNull();
    expect(await syncPull.cursor(db, 'parking_session')).toBe(there.server_updated_us - 1);

    await sessions.end(db, here);
    await syncPull.apply(db, { parking_session: [there] });

    expect(await row('parking_session', 's-there')).toMatchObject({ status: 'active', level: 'L3' });
  });
});

describe('two cars with one name', () => {
  it('keeps the older, as the default, and moves the other\'s parking to it', async () => {
    // A new phone asks for a car before it can sign in.
    const newId = await vehicles.add(db, { name: 'My Myvi' });
    const sessionId = await sessions.start(db, { vehicle_id: newId });

    await syncPull.apply(db, { vehicle: [car('v-old', 'my myvi', { created_at: at('2026-01-01T09:00') })] });

    expect(await row('vehicle', newId)).toMatchObject({ merged_into: 'v-old', is_default: 0, dirty: 1 });
    expect(await vehicles.list(db)).toEqual([expect.objectContaining({ id: 'v-old', is_default: 1 })]);
    expect(await row('parking_session', sessionId)).toMatchObject({ vehicle_id: 'v-old', status: 'active' });
  });

  it('waits while both are parked, so one car is never parked twice', async () => {
    const newId = await vehicles.add(db, { name: 'My Myvi' });
    await sessions.start(db, { vehicle_id: newId });

    await syncPull.apply(db, {
      vehicle: [car('v-old', 'My Myvi', { created_at: at('2026-01-01T09:00') })],
      parking_session: [session('s-old', 'v-old')],
    });

    expect((await vehicles.list(db)).map((c) => c.id).sort()).toEqual([newId, 'v-old'].sort());
  });

  it('leaves an archived car with the same name alone', async () => {
    const newId = await vehicles.add(db, { name: 'My Myvi' });

    await syncPull.apply(db, { vehicle: [car('v-old', 'My Myvi', { archived: true, created_at: at('2026-01-01T09:00') })] });

    expect(await row('vehicle', newId)).toMatchObject({ deleted_at: null, merged_into: null });
  });
});

describe('one default car', () => {
  it('keeps the older car as the default when each phone made its first car the default', async () => {
    const axia = await vehicles.add(db, { name: 'My Axia' });

    await syncPull.apply(db, { vehicle: [car('v-myvi', 'My Myvi', { is_default: true })] });

    expect(await row('vehicle', axia)).toMatchObject({ is_default: 0, dirty: 1 });
    expect(await row('vehicle', 'v-myvi')).toMatchObject({ is_default: 1 });
  });
});
