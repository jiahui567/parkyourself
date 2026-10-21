import { openMigratedTestDatabase } from '../../test/testDatabase';
import { places } from './places';
import { sessions } from './sessions';
import { vehicles } from './vehicles';

let db;
let myvi;
beforeEach(async () => {
  db = await openMigratedTestDatabase();
  myvi = await vehicles.add(db, { name: 'My Myvi' });
});
afterEach(() => db.close());

describe('sessions.start', () => {
  it('stores level and bay in capitals and empty text as null', async () => {
    const id = await sessions.start(db, {
      vehicle_id: myvi,
      level: ' b2 ',
      bay: 'c14',
      zone_colour_name: 'Blue',
      access_type: 'escalator',
      landmark: ' Starbucks ',
      note: '   ',
      started_at: 1000,
    });

    expect(await sessions.get(db, id)).toMatchObject({
      status: 'active',
      started_at: 1000,
      level: 'B2',
      bay: 'C14',
      zone_colour_name: 'Blue',
      access_type: 'escalator',
      landmark: 'Starbucks',
      note: null,
    });
  });

  it('refuses a car that is already parked', async () => {
    await sessions.start(db, { vehicle_id: myvi });

    await expect(sessions.start(db, { vehicle_id: myvi })).rejects.toThrow('already parked');
  });

  it('lets two different cars park at the same time', async () => {
    const axia = await vehicles.add(db, { name: 'Axia' });
    await sessions.start(db, { vehicle_id: myvi });

    await expect(sessions.start(db, { vehicle_id: axia })).resolves.toEqual(expect.any(String));
  });

  it('rejects an unknown access type', async () => {
    await expect(sessions.start(db, { vehicle_id: myvi, access_type: 'ramp' })).rejects.toThrow('Unknown access type');
  });
});

describe('sessions.end', () => {
  it('ends the session and frees the car to park again', async () => {
    const id = await sessions.start(db, { vehicle_id: myvi, started_at: 1000 });

    await sessions.end(db, id, { ended_at: 5000 });

    expect(await sessions.get(db, id)).toMatchObject({ status: 'ended', ended_at: 5000, fee_sen: null });
    await expect(sessions.start(db, { vehicle_id: myvi })).resolves.toEqual(expect.any(String));
  });

  it('refuses to end a session twice', async () => {
    const id = await sessions.start(db, { vehicle_id: myvi, started_at: 1000 });
    await sessions.end(db, id, { ended_at: 5000 });

    await expect(sessions.end(db, id, { ended_at: 6000 })).rejects.toThrow('already ended');
  });

  it('refuses an end time before the start', async () => {
    const id = await sessions.start(db, { vehicle_id: myvi, started_at: 5000 });

    await expect(sessions.end(db, id, { ended_at: 1000 })).rejects.toThrow('cannot end before');
    expect((await sessions.get(db, id)).status).toBe('active');
  });
});

describe('listing sessions', () => {
  it('lists parked cars with their names, newest first', async () => {
    const axia = await vehicles.add(db, { name: 'Axia' });
    await sessions.start(db, { vehicle_id: myvi, started_at: 1000 });
    await sessions.start(db, { vehicle_id: axia, started_at: 2000 });

    expect((await sessions.listActive(db)).map((s) => s.vehicle_name)).toEqual(['Axia', 'My Myvi']);
  });

  it('lists ended sessions newest first, without deleted ones', async () => {
    const first = await sessions.start(db, { vehicle_id: myvi, started_at: 1000 });
    await sessions.end(db, first, { ended_at: 1500 });
    const second = await sessions.start(db, { vehicle_id: myvi, started_at: 2000 });
    await sessions.end(db, second, { ended_at: 2500 });
    const deleted = await sessions.start(db, { vehicle_id: myvi, started_at: 3000 });
    await sessions.end(db, deleted, { ended_at: 3500 });
    await sessions.remove(db, deleted);

    expect((await sessions.listHistory(db)).map((s) => s.id)).toEqual([second, first]);
  });

  it('includes the place name in the details', async () => {
    const place = await places.create(db, { name: 'Pavilion Bukit Jalil' });
    const id = await sessions.create(db, { vehicle_id: myvi, place_id: place, status: 'active', started_at: 1000 });

    expect(await sessions.getDetails(db, id)).toMatchObject({
      vehicle_name: 'My Myvi',
      place_name: 'Pavilion Bukit Jalil',
    });
  });

  it('returns null details for a deleted session', async () => {
    const id = await sessions.start(db, { vehicle_id: myvi });
    await sessions.remove(db, id);

    expect(await sessions.getDetails(db, id)).toBeNull();
  });
});
