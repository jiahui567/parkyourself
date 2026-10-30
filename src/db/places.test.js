import { openMigratedTestDatabase } from '../../test/testDatabase';
import { holidayRate } from '../fees';
import { places } from './places';
import { sessions } from './sessions';
import { vehicles } from './vehicles';

const WEEKDAY = {
  type: 'hourly',
  first_minutes: 60,
  first_sen: 300,
  block_minutes: 60,
  block_sen: 200,
  grace_minutes: 15,
  daily_cap_sen: 2000,
  flat_sen: null,
};
const WEEKEND = { ...WEEKDAY, first_sen: 400, block_sen: 300, grace_minutes: 0, daily_cap_sen: 2500 };

let db;
beforeEach(async () => {
  db = await openMigratedTestDatabase();
});
afterEach(() => db.close());

const names = (rows) => rows.map((p) => p.name);

describe('places.search', () => {
  it('finds a place by any part of its name, in any case', async () => {
    await places.create(db, { name: 'Pavilion Bukit Jalil' });
    await places.create(db, { name: 'Mid Valley' });

    expect(names(await places.search(db, 'BUKIT'))).toEqual(['Pavilion Bukit Jalil']);
  });

  it('matches % and _ as typed, not as wildcards', async () => {
    await places.create(db, { name: 'Lot_10' });
    await places.create(db, { name: 'Lot 10' });
    await places.create(db, { name: '100% Mall' });

    expect(names(await places.search(db, '_'))).toEqual(['Lot_10']);
    expect(names(await places.search(db, '0%'))).toEqual(['100% Mall']);
  });

  it('lists recently used places first, then the rest by name, without deleted ones', async () => {
    await places.create(db, { name: 'Sunway Pyramid' });
    await places.create(db, { name: 'atria' });
    await places.create(db, { name: 'Mid Valley', last_used_at: 1000 });
    await places.create(db, { name: 'Pavilion', last_used_at: 3000 });
    const deleted = await places.create(db, { name: 'IOI City', last_used_at: 5000 });
    await places.remove(db, deleted);

    expect(names(await places.search(db))).toEqual(['Pavilion', 'Mid Valley', 'atria', 'Sunway Pyramid']);
  });
});

describe('places.findByName', () => {
  it('ignores case and surrounding spaces', async () => {
    const id = await places.create(db, { name: 'Pavilion Bukit Jalil' });

    expect((await places.findByName(db, '  pavilion BUKIT jalil ')).id).toBe(id);
  });

  it('does not find a deleted place', async () => {
    const id = await places.create(db, { name: 'Pavilion' });
    await places.remove(db, id);

    expect(await places.findByName(db, 'Pavilion')).toBeNull();
  });
});

describe('places.listWithVisits', () => {
  it('counts the sessions parked at each place, leaving out deleted sessions', async () => {
    const myvi = await vehicles.add(db, { name: 'My Myvi' });
    const pavilion = await places.create(db, { name: 'Pavilion' });
    await places.create(db, { name: 'Atria' });
    const visit = { vehicle_id: myvi, place_id: pavilion, status: 'ended', started_at: 1000, ended_at: 2000 };
    await sessions.create(db, visit);
    await sessions.create(db, visit);
    await sessions.remove(db, await sessions.create(db, visit));

    expect((await places.listWithVisits(db)).map((p) => [p.name, p.visits])).toEqual([
      ['Atria', 0],
      ['Pavilion', 2],
    ]);
  });
});

describe('places.saveRate', () => {
  it('replaces the saved rate for a day type instead of adding a second one', async () => {
    const id = await places.create(db, { name: 'Pavilion' });
    const first = await places.saveRate(db, id, 'weekend', WEEKDAY);

    const second = await places.saveRate(db, id, 'weekend', WEEKEND);

    expect(second).toBe(first);
    expect(await places.getRates(db, id)).toEqual({
      weekday: null,
      weekend: expect.objectContaining({ id: first, ...WEEKEND }),
      holiday: null,
    });
  });

  it('refuses an hourly public holiday rate', async () => {
    const id = await places.create(db, { name: 'Pavilion' });

    await expect(places.saveRate(db, id, 'holiday', WEEKDAY)).rejects.toThrow('flat price per entry');
  });

  it('refuses a rate the fee functions cannot use', async () => {
    const id = await places.create(db, { name: 'Pavilion' });

    await expect(places.saveRate(db, id, 'weekday', { ...WEEKDAY, block_minutes: 0 })).rejects.toThrow(
      'block_minutes'
    );
  });
});

describe('places.saveDetails', () => {
  it('renames the place and saves, removes or keeps each rate', async () => {
    const id = await places.create(db, { name: 'Pavilion' });
    await places.saveRate(db, id, 'weekday', WEEKDAY);
    await places.saveRate(db, id, 'holiday', holidayRate(800));

    await places.saveDetails(db, id, { name: ' Pavilion Bukit Jalil ', rates: { weekend: WEEKEND, holiday: null } });

    const rates = await places.getRates(db, id);
    expect((await places.get(db, id)).name).toBe('Pavilion Bukit Jalil');
    expect(rates.weekday).toMatchObject(WEEKDAY);
    expect(rates.weekend).toMatchObject(WEEKEND);
    expect(rates.holiday).toBeNull();
  });

  it('refuses the name of another place, in any case, and saves nothing', async () => {
    await places.create(db, { name: 'Mid Valley' });
    const id = await places.create(db, { name: 'Pavilion' });

    await expect(places.saveDetails(db, id, { name: 'mid valley', rates: { weekday: WEEKDAY } })).rejects.toThrow(
      'You already have a place called Mid Valley.'
    );
    expect((await places.get(db, id)).name).toBe('Pavilion');
    expect((await places.getRates(db, id)).weekday).toBeNull();
  });

  it('lets a place change the case of its own name', async () => {
    const id = await places.create(db, { name: 'pavilion' });

    await places.saveDetails(db, id, { name: 'Pavilion' });

    expect((await places.get(db, id)).name).toBe('Pavilion');
  });

  // The form leaves out a name it did not change, so one another phone gave
  // the place while it was open is kept.
  it('keeps the name when it is left out, and still saves the rates', async () => {
    const id = await places.create(db, { name: 'Pavilion' });
    await places.update(db, id, { name: 'Pavilion KL' });

    await places.saveDetails(db, id, { rates: { weekday: WEEKDAY } });

    expect((await places.get(db, id)).name).toBe('Pavilion KL');
    expect((await places.getRates(db, id)).weekday).toMatchObject(WEEKDAY);
  });

  it('refuses an empty name', async () => {
    const id = await places.create(db, { name: 'Pavilion' });

    await expect(places.saveDetails(db, id, { name: '  ' })).rejects.toThrow('Give the place a name.');
    await expect(places.saveDetails(db, id, { name: null })).rejects.toThrow('Give the place a name.');
  });
});

describe('places.listLocated', () => {
  it('lists live places that have a location', async () => {
    await places.create(db, { name: 'Sunway Velocity', lat: 3.1279, lng: 101.7238 });
    await places.create(db, { name: 'No pin' });
    const gone = await places.create(db, { name: 'Gone', lat: 3.1, lng: 101.7 });
    await places.remove(db, gone);

    expect(await places.listLocated(db)).toEqual([
      expect.objectContaining({ name: 'Sunway Velocity', lat: 3.1279, lng: 101.7238 }),
    ]);
  });
});
