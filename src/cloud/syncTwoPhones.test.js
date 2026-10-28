import { createFakeServer } from '../../test/fakeServer';
import { openMigratedTestDatabase } from '../../test/testDatabase';
import { holidays, places, sessions, SYNCED_TABLES, syncRows, syncState, toServerRow, vehicles } from '../db';
import { pullSyncedRows, pushSyncedRows, signedInAccount } from './supabase';
import { addPhoneDataToAccount, PUSH_BATCH, syncNow } from './sync';

// Two phones signed in to one account, against an in-memory server
// (test/fakeServer.js): PLAN.md, "Testing", for the sync. "Offline" is a
// phone that makes changes without syncing.
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
const at = (t) => new Date(t).getTime();

let server;
let clock;
const opened = [];
beforeEach(() => {
  server = createFakeServer();
  signedInAccount.mockResolvedValue(A);
  pushSyncedRows.mockImplementation(async (table, rows) => server.push(table, rows));
  pullSyncedRows.mockImplementation(async (table, options) => server.pull(table, options));
  clock = jest.spyOn(Date, 'now');
});
afterEach(() => {
  jest.restoreAllMocks();
  opened.splice(0).forEach((db) => db.close());
});

async function newPhone() {
  const db = await openMigratedTestDatabase();
  opened.push(db);
  return db;
}

const time = (t) => clock.mockReturnValue(at(t));

// Phone one has had the account a while; phone two is new, and asks for a
// car before it can sign in.
async function twoPhones() {
  const one = await newPhone();
  const two = await newPhone();
  time('2026-10-01T09:00');
  const carId = await vehicles.add(one, { name: 'My Myvi' });
  await syncNow(one);
  time('2026-10-27T09:00');
  await vehicles.add(two, { name: 'My Myvi' });
  await syncNow(two);
  await syncNow(one);
  return { one, two, carId };
}

// The phone holds exactly the server's rows, and nothing waits to be pushed.
async function expectInStep(db) {
  for (const table of SYNCED_TABLES) {
    const phone = (await db.getAllAsync(`SELECT * FROM ${table} ORDER BY id`)).map((row) => toServerRow(table, row));
    expect({ table, rows: phone }).toEqual({ table, rows: server.rows(table) });
  }
  expect(await syncRows.countDirty(db)).toBe(0);
}

it('a new phone gets everything, and its first car becomes the one already backed up', async () => {
  const one = await newPhone();
  time('2026-10-01T09:00');
  const carId = await vehicles.add(one, { name: 'My Myvi' });
  await holidays.add(one, { holiday_date: '2026-12-25', name: 'Christmas' });
  const parked = await sessions.start(one, {
    vehicle_id: carId,
    place_name: 'Mid Valley',
    level: 'B2',
    rates: { weekday: { type: 'flat', flat_sen: 500 } },
    save_rates: ['weekday'],
  });
  await sessions.end(one, parked, { ended_at: at('2026-10-01T11:00') });
  await syncNow(one);

  const two = await newPhone();
  time('2026-10-27T09:00');
  const secondCar = await vehicles.add(two, { name: 'my myvi' });
  expect((await syncNow(two)).status).toBe('synced');
  await syncNow(one);

  for (const phone of [one, two]) {
    expect(await vehicles.list(phone)).toEqual([expect.objectContaining({ id: carId, is_default: 1 })]);
    expect((await places.listWithVisits(phone)).map((p) => [p.name, p.visits])).toEqual([['Mid Valley', 1]]);
    expect((await holidays.list(phone)).map((h) => h.name)).toEqual(['Christmas']);
    expect(await sessions.listHistory(phone)).toEqual([expect.objectContaining({ id: parked, fee_sen: 500 })]);
    await expectInStep(phone);
  }
  expect(await two.getFirstAsync('SELECT merged_into FROM vehicle WHERE id = ?', [secondCar])).toEqual({
    merged_into: carId,
  });
});

it('the later of two offline changes to one row wins on both phones', async () => {
  const { one, two, carId } = await twoPhones();
  time('2026-10-27T12:00');
  await vehicles.rename(one, carId, 'Our Myvi');
  time('2026-10-27T12:05');
  await vehicles.rename(two, carId, 'Family Myvi');

  await syncNow(two);
  await syncNow(one);

  for (const phone of [one, two]) {
    expect((await vehicles.get(phone, carId)).name).toBe('Family Myvi');
    await expectInStep(phone);
  }
});

it('a place deleted on one phone disappears on the other', async () => {
  const { one, two } = await twoPhones();
  time('2026-10-27T10:00');
  const placeId = await places.create(one, { name: 'Sunway Pyramid' });
  await syncNow(one);
  await syncNow(two);
  expect(await places.get(two, placeId)).toMatchObject({ name: 'Sunway Pyramid' });

  time('2026-10-27T10:10');
  await places.remove(one, placeId);
  await syncNow(one);
  await syncNow(two);

  expect(await places.get(two, placeId)).toBeNull();
  await expectInStep(two);
});

it('one place made offline on both phones becomes one, with the newer rate and both visits', async () => {
  const { one, two, carId } = await twoPhones();
  const parkAt = async (phone, name, flatSen) => {
    const id = await sessions.start(phone, {
      vehicle_id: carId,
      place_name: name,
      rates: { weekday: { type: 'flat', flat_sen: flatSen } },
      save_rates: ['weekday'],
    });
    await sessions.end(phone, id);
  };
  time('2026-10-27T10:00');
  await parkAt(one, 'Pavilion', 300);
  time('2026-10-27T10:05');
  await parkAt(two, 'pavilion', 400);

  await syncNow(one);
  await syncNow(two);
  await syncNow(one);

  for (const phone of [one, two]) {
    const [kept] = await places.listWithVisits(phone);
    expect(await places.listWithVisits(phone)).toEqual([expect.objectContaining({ name: 'pavilion', visits: 2 })]);
    expect((await places.getRates(phone, kept.id)).weekday).toMatchObject({ flat_sen: 400 });
    await expectInStep(phone);
  }
});

it('one holiday made offline on both phones becomes one, the older, with its name', async () => {
  const { one, two } = await twoPhones();
  time('2026-10-27T10:00');
  await holidays.add(one, { holiday_date: '2026-12-25', name: 'Christmas' });
  time('2026-10-27T09:30');
  const older = await holidays.add(two, { holiday_date: '2026-12-25' });

  await syncNow(one);
  await syncNow(two);
  await syncNow(one);

  for (const phone of [one, two]) {
    expect(await holidays.list(phone)).toEqual([expect.objectContaining({ id: older, name: 'Christmas' })]);
    await expectInStep(phone);
  }
});

it('a car parked on both phones is never merged: the second waits until one is found', async () => {
  const { one, two, carId } = await twoPhones();
  time('2026-10-27T11:00');
  const first = await sessions.start(one, { vehicle_id: carId, level: 'L3', bay: 'C14' });
  await syncNow(one);
  time('2026-10-27T11:05');
  const second = await sessions.start(two, { vehicle_id: carId, level: 'B2' });

  await syncNow(two);

  // Phone two keeps its own, says where the other one is, and does not take it.
  expect((await sessions.listActive(two)).map((s) => s.id)).toEqual([second]);
  expect(await syncState.refusedSession(two, second)).toMatchObject({
    constraint: 'one_active_session_per_vehicle',
    other: { id: first, level: 'L3', bay: 'C14' },
  });

  time('2026-10-27T11:30');
  await sessions.end(two, second);
  await syncNow(two);
  await syncNow(one);

  for (const phone of [one, two]) {
    expect((await sessions.listActive(phone)).map((s) => s.id)).toEqual([first]);
    await expectInStep(phone);
  }
  // Only the phone that parked shows its notifications.
  expect(await two.getFirstAsync('SELECT parked_here FROM parking_session WHERE id = ?', [first])).toEqual({
    parked_here: 0,
  });
  expect(await one.getFirstAsync('SELECT parked_here FROM parking_session WHERE id = ?', [first])).toEqual({
    parked_here: 1,
  });
});

it('a long history reaches a new phone in pages', async () => {
  const { one, two } = await twoPhones();
  const day = at('2026-01-01T12:00');
  time('2026-10-27T10:00');
  for (let i = 0; i < 250; i++) {
    await holidays.add(one, { holiday_date: new Date(day + i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) });
  }
  await syncNow(one);

  await syncNow(two);

  expect(await holidays.list(two)).toHaveLength(250);
  await expectInStep(two);

  // The next sync reads again only the last minute (the overlap): the
  // holidays of the last push, not all of them, and they change nothing.
  const pull = jest.spyOn(server, 'pull');
  expect(await syncNow(two)).toMatchObject({ status: 'synced', pulled: 0 });
  const holidaysRead = pull.mock.calls.flatMap(([table], i) => (table === 'public_holiday' ? pull.mock.results[i].value : []));
  expect(holidaysRead).toHaveLength(PUSH_BATCH);
});

// Each account's rows are its own on the server, even with the same ids, so
// each account here has a server of its own. That the server keeps them apart
// (supabase/migrations/20261028014940_synced_rows_per_account.sql) is
// pgTAP's to test (sync_push.test.sql); this is the phone's side.
it('a phone backed up to one account adds its data to another, and the same car becomes one', async () => {
  const one = await newPhone();
  time('2026-10-01T09:00');
  const carId = await vehicles.add(one, { name: 'My Myvi' });
  await places.create(one, { name: 'Mid Valley' });
  await syncNow(one);

  // Someone else's phone, with their own account and a car of the same name.
  server = createFakeServer();
  signedInAccount.mockResolvedValue(B);
  const two = await newPhone();
  time('2026-10-20T09:00');
  const theirCar = await vehicles.add(two, { name: 'my myvi' });
  await syncNow(two);

  // Phone one signs in to B: nothing goes until the user says so.
  await syncState.setAccount(one, B);
  expect((await syncNow(one)).status).toBe('other account');
  time('2026-10-28T09:00');
  expect((await addPhoneDataToAccount(one)).status).toBe('synced');
  await syncNow(two);

  for (const phone of [one, two]) {
    expect(await vehicles.list(phone)).toEqual([expect.objectContaining({ id: carId, is_default: 1 })]);
    expect((await places.listWithVisits(phone)).map((p) => p.name)).toEqual(['Mid Valley']);
    await expectInStep(phone);
  }
  expect(await two.getFirstAsync('SELECT merged_into FROM vehicle WHERE id = ?', [theirCar])).toEqual({
    merged_into: carId,
  });
  expect(await syncState.get(one)).toMatchObject({ owner: B, otherAccount: false, pending: 0 });
});
