import { openMigratedTestDatabase } from '../../test/testDatabase';
import { sessions } from './sessions';
import { vehicles } from './vehicles';

let db;
beforeEach(async () => {
  db = await openMigratedTestDatabase();
});
afterEach(() => db.close());

describe('vehicles.add', () => {
  it('makes the first car the default, and later cars not', async () => {
    const myvi = await vehicles.add(db, { name: 'My Myvi' });
    const axia = await vehicles.add(db, { name: 'Axia' });

    expect((await vehicles.get(db, myvi)).is_default).toBe(1);
    expect((await vehicles.get(db, axia)).is_default).toBe(0);
  });

  it('trims the name', async () => {
    const id = await vehicles.add(db, { name: '  My Myvi  ' });

    expect((await vehicles.get(db, id)).name).toBe('My Myvi');
  });

  it.each(['', '   ', null])('rejects the name %p', async (name) => {
    await expect(vehicles.add(db, { name })).rejects.toThrow('Give the car a name');
  });
});

describe('vehicles.list', () => {
  it('lists the default car first, then by name, without archived cars', async () => {
    await vehicles.add(db, { name: 'Myvi' });
    await vehicles.add(db, { name: 'civic' });
    const archived = await vehicles.add(db, { name: 'Bezza' });
    await vehicles.archive(db, archived);

    expect((await vehicles.list(db)).map((v) => v.name)).toEqual(['Myvi', 'civic']);
  });
});

describe('vehicles.setDefault', () => {
  it('moves the default to the chosen car', async () => {
    const myvi = await vehicles.add(db, { name: 'Myvi' });
    const axia = await vehicles.add(db, { name: 'Axia' });

    await vehicles.setDefault(db, axia);

    expect((await vehicles.get(db, axia)).is_default).toBe(1);
    expect((await vehicles.get(db, myvi)).is_default).toBe(0);
  });

  it('rejects an unknown car and keeps the old default', async () => {
    const myvi = await vehicles.add(db, { name: 'Myvi' });

    await expect(vehicles.setDefault(db, 'no-such-car')).rejects.toThrow('No car');
    expect((await vehicles.get(db, myvi)).is_default).toBe(1);
  });
});

describe('vehicles.archive', () => {
  it('passes the default to the next car when the default is archived', async () => {
    const myvi = await vehicles.add(db, { name: 'Myvi' });
    const axia = await vehicles.add(db, { name: 'Axia' });

    await vehicles.archive(db, myvi);

    expect(await vehicles.get(db, myvi)).toMatchObject({ archived: 1, is_default: 0 });
    expect((await vehicles.get(db, axia)).is_default).toBe(1);
  });

  it('leaves the default alone when another car is archived', async () => {
    const myvi = await vehicles.add(db, { name: 'Myvi' });
    const axia = await vehicles.add(db, { name: 'Axia' });
    const before = await vehicles.get(db, myvi);

    await vehicles.archive(db, axia);

    expect(await vehicles.get(db, myvi)).toEqual(before);
  });

  it('refuses to archive a parked car', async () => {
    const myvi = await vehicles.add(db, { name: 'Myvi' });
    await sessions.start(db, { vehicle_id: myvi });

    await expect(vehicles.archive(db, myvi)).rejects.toThrow('This car is parked');
    expect((await vehicles.get(db, myvi)).archived).toBe(0);
  });
});
