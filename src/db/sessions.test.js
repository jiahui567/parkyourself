import { openMigratedTestDatabase } from '../../test/testDatabase';
import { holidayRate, ratesFromSnapshot } from '../fees';
import { holidays } from './holidays';
import { places } from './places';
import { preferences } from './preferences';
import { sessions } from './sessions';
import { vehicles } from './vehicles';

// Local phone time (jest.config.js pins Asia/Kuala_Lumpur). 2026-10-23 is a
// Friday, 2026-10-27 a Tuesday, 2026-10-28 a Wednesday.
const at = (localDateTime) => new Date(localDateTime).getTime();

// The rates from PLAN.md's fee test table, as feeFields gives them.
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
let myvi;
beforeEach(async () => {
  db = await openMigratedTestDatabase();
  myvi = await vehicles.add(db, { name: 'My Myvi' });
});
afterEach(() => db.close());

const liveRows = async (table) =>
  (await db.getFirstAsync(`SELECT COUNT(*) AS n FROM ${table} WHERE deleted_at IS NULL`)).n;

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

  it('creates a place for a new name and reuses it whatever the case', async () => {
    const first = await sessions.start(db, { vehicle_id: myvi, place_name: ' Pavilion ', started_at: 1000 });
    await sessions.end(db, first, { ended_at: 2000 });

    const second = await sessions.start(db, { vehicle_id: myvi, place_name: 'PAVILION', started_at: 3000 });

    const place = await places.findByName(db, 'pavilion');
    expect(place).toMatchObject({ name: 'Pavilion', last_used_at: 3000 });
    expect((await sessions.get(db, second)).place_id).toBe(place.id);
    expect(await liveRows('place')).toBe(1);
  });

  it('saves only the rates in save_rates, and snapshots the saved rates with the typed ones on top', async () => {
    const place = await places.create(db, { name: 'Pavilion' });
    await places.saveRate(db, place, 'weekday', WEEKDAY);
    await places.saveRate(db, place, 'weekend', WEEKEND);
    const promo = { ...WEEKEND, first_sen: 100 };
    const holiday = holidayRate(800);

    const id = await sessions.start(db, {
      vehicle_id: myvi,
      place_name: 'Pavilion',
      rates: { weekend: promo, holiday },
      save_rates: ['holiday'],
    });

    expect(ratesFromSnapshot((await sessions.get(db, id)).rate_snapshot)).toEqual({
      weekday: WEEKDAY,
      weekend: promo,
      holiday,
    });
    const saved = await places.getRates(db, place);
    expect(saved.weekend).toMatchObject(WEEKEND);
    expect(saved.holiday).toMatchObject(holiday);
  });

  it('adds the local date of the start to the holiday list, not the UTC date', async () => {
    // 00:30 on Saturday 24 Oct in Kuala Lumpur is still Friday in UTC.
    await sessions.start(db, {
      vehicle_id: myvi,
      public_holiday: true,
      started_at: Date.parse('2026-10-23T16:30:00Z'),
    });

    expect(await holidays.dateSet(db)).toEqual(new Set(['2026-10-24']));
  });

  it('leaves no place, rate or holiday behind when the start fails', async () => {
    await expect(
      sessions.start(db, {
        vehicle_id: 'no-such-car',
        place_name: 'Pavilion',
        rates: { weekday: WEEKDAY },
        save_rates: ['weekday'],
        public_holiday: true,
      })
    ).rejects.toThrow(/FOREIGN KEY/i);

    expect([await liveRows('place'), await liveRows('place_rate'), await liveRows('public_holiday')]).toEqual([
      0, 0, 0,
    ]);
  });

  it('refuses a public holiday rate that is not flat, before writing anything', async () => {
    await expect(
      sessions.start(db, { vehicle_id: myvi, place_name: 'Pavilion', rates: { holiday: WEEKDAY } })
    ).rejects.toThrow('flat price per entry');
    expect(await liveRows('place')).toBe(0);
  });

  it('saves the timer end time', async () => {
    const id = await sessions.start(db, { vehicle_id: myvi, started_at: 1000, timer_ends_at: 9000 });

    expect((await sessions.get(db, id)).timer_ends_at).toBe(9000);
  });

  it.each([
    { rule: 'a timer that does not end after the start', input: { timer_ends_at: 1000 }, error: 'after you park' },
    {
      rule: 'saving a rate for a day type with no rate',
      input: { place_name: 'Pavilion', rates: { weekday: WEEKDAY }, save_rates: ['weekend'] },
      error: 'No weekend rate to save',
    },
    {
      rule: 'saving a rate with no place',
      input: { rates: { weekday: WEEKDAY }, save_rates: ['weekday'] },
      error: 'Pick a place to save the rate to.',
    },
  ])('refuses $rule, before writing anything', async ({ input, error }) => {
    await expect(sessions.start(db, { vehicle_id: myvi, started_at: 1000, ...input })).rejects.toThrow(error);

    expect([await liveRows('parking_session'), await liveRows('place'), await liveRows('place_rate')]).toEqual([
      0, 0, 0,
    ]);
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

  // Parks at Pavilion with these rates saved to it.
  const parkAtPavilion = (started_at, rates = { weekday: WEEKDAY }) =>
    sessions.start(db, {
      vehicle_id: myvi,
      place_name: 'Pavilion',
      rates,
      save_rates: Object.keys(rates),
      started_at,
    });

  it('calculates and stores the fee from the rate snapshot', async () => {
    const id = await parkAtPavilion(at('2026-10-27T10:00'));
    // A later change to the place's rate must not change this stay's fee.
    await places.saveRate(db, (await sessions.get(db, id)).place_id, 'weekday', WEEKEND);

    await expect(sessions.end(db, id, { ended_at: at('2026-10-27T12:10') })).resolves.toEqual({
      fee_sen: 700,
      paid_sen: null,
    });
    expect((await sessions.get(db, id)).fee_sen).toBe(700);
  });

  it('stores the overnight estimate, each day at its own rate', async () => {
    const id = await parkAtPavilion(at('2026-10-23T20:00'), { weekday: WEEKDAY, weekend: WEEKEND });

    await sessions.end(db, id, { ended_at: at('2026-10-24T10:00') });

    expect((await sessions.get(db, id)).fee_sen).toBe(3400);
  });

  it('uses the holiday list as it is when the session ends', async () => {
    const id = await parkAtPavilion(at('2026-10-28T10:00'), { weekday: WEEKDAY, holiday: holidayRate(800) });
    await holidays.add(db, { holiday_date: '2026-10-28' });

    await sessions.end(db, id, { ended_at: at('2026-10-28T15:00') });

    expect((await sessions.get(db, id)).fee_sen).toBe(800);
  });

  it('saves a missing rate typed at the end to the place and uses it for the fee', async () => {
    const id = await parkAtPavilion(at('2026-10-23T20:00'));

    await sessions.end(db, id, { ended_at: at('2026-10-24T10:00'), missing_rates: { weekend: WEEKEND } });

    const session = await sessions.get(db, id);
    expect(session.fee_sen).toBe(3400);
    expect(ratesFromSnapshot(session.rate_snapshot).weekend).toEqual(WEEKEND);
    expect((await places.getRates(db, session.place_id)).weekend).toMatchObject(WEEKEND);
  });

  it('prices a stay at a place with no rate from the rate typed at the end, and saves it there', async () => {
    const id = await sessions.start(db, { vehicle_id: myvi, place_name: 'Pavilion', started_at: at('2026-10-27T10:00') });

    await sessions.end(db, id, { ended_at: at('2026-10-27T12:10'), missing_rates: { weekday: WEEKDAY } });

    const session = await sessions.get(db, id);
    expect(session.fee_sen).toBe(700);
    expect(ratesFromSnapshot(session.rate_snapshot)).toEqual({ weekday: WEEKDAY });
    expect((await places.getRates(db, session.place_id)).weekday).toMatchObject(WEEKDAY);
  });

  it('uses a missing rate without overwriting one the place gained while parked', async () => {
    const id = await parkAtPavilion(at('2026-10-23T20:00'));
    const placeId = (await sessions.get(db, id)).place_id;
    const later = { ...WEEKEND, first_sen: 500 };
    await places.saveRate(db, placeId, 'weekend', later);

    await sessions.end(db, id, { ended_at: at('2026-10-24T10:00'), missing_rates: { weekend: WEEKEND } });

    expect((await sessions.get(db, id)).fee_sen).toBe(3400);
    expect((await places.getRates(db, placeId)).weekend).toMatchObject(later);
  });

  it('uses a missing rate for a place deleted while parked', async () => {
    const id = await parkAtPavilion(at('2026-10-23T20:00'));
    await places.remove(db, (await sessions.get(db, id)).place_id);

    await sessions.end(db, id, { ended_at: at('2026-10-24T10:00'), missing_rates: { weekend: WEEKEND } });

    expect((await sessions.get(db, id)).fee_sen).toBe(3400);
    expect(await liveRows('place_rate')).toBe(0);
  });

  it.each([
    { rule: 'paid the fee', rates: { weekday: WEEKDAY }, paid: 700, stored: { fee_sen: 700, paid_sen: null } },
    { rule: 'paid less than the fee', rates: { weekday: WEEKDAY }, paid: 500, stored: { fee_sen: 700, paid_sen: 500 } },
    { rule: 'left Amount paid empty', rates: { weekday: WEEKDAY }, paid: null, stored: { fee_sen: 700, paid_sen: null } },
    { rule: 'typed an amount with no rate', rates: null, paid: 500, stored: { fee_sen: null, paid_sen: 500 } },
  ])('stores paid_sen only when it differs from the fee: $rule', async ({ rates, paid, stored }) => {
    const id = await sessions.start(db, { vehicle_id: myvi, rates, started_at: at('2026-10-27T10:00') });

    await sessions.end(db, id, { ended_at: at('2026-10-27T12:10'), paid_sen: paid });

    expect(await sessions.get(db, id)).toMatchObject(stored);
  });

  it('refuses an amount paid that is not whole sen', async () => {
    const id = await sessions.start(db, { vehicle_id: myvi, started_at: 1000 });

    await expect(sessions.end(db, id, { ended_at: 5000, paid_sen: 3.5 })).rejects.toThrow('amount paid');
    expect((await sessions.get(db, id)).status).toBe('active');
  });
});

describe('sessions.setTimer', () => {
  it('sets and clears the timer of a parked car', async () => {
    const id = await sessions.start(db, { vehicle_id: myvi, started_at: 1000 });

    await sessions.setTimer(db, id, 9000);
    expect((await sessions.get(db, id)).timer_ends_at).toBe(9000);
    await sessions.setTimer(db, id, null);
    expect((await sessions.get(db, id)).timer_ends_at).toBeNull();
  });

  it('refuses a timer that does not end after the car was parked', async () => {
    const id = await sessions.start(db, { vehicle_id: myvi, started_at: 5000 });

    await expect(sessions.setTimer(db, id, 5000)).rejects.toThrow('after you park');
  });

  it('refuses a session that has ended', async () => {
    const id = await sessions.start(db, { vehicle_id: myvi, started_at: 1000 });
    await sessions.end(db, id, { ended_at: 2000 });

    await expect(sessions.setTimer(db, id, 9000)).rejects.toThrow('already ended');
  });
});

describe('sessions.extend', () => {
  const MINUTE = 60 * 1000;

  it('adds the default 30 minutes to a running timer', async () => {
    const id = await sessions.start(db, {
      vehicle_id: myvi,
      started_at: at('2026-10-27T10:00'),
      timer_ends_at: at('2026-10-27T11:00'),
    });

    const ends = await sessions.extend(db, id, at('2026-10-27T10:40'));

    expect(ends).toBe(at('2026-10-27T11:30'));
    expect((await sessions.get(db, id)).timer_ends_at).toBe(ends);
  });

  it('starts a timer from now when there is none', async () => {
    const id = await sessions.start(db, { vehicle_id: myvi, started_at: at('2026-10-27T10:00') });

    expect(await sessions.extend(db, id, at('2026-10-27T10:40'))).toBe(at('2026-10-27T10:40') + 30 * MINUTE);
  });

  it('uses the Extend amount chosen in Settings', async () => {
    await preferences.setExtendMinutes(db, 15);
    const id = await sessions.start(db, { vehicle_id: myvi, started_at: at('2026-10-27T10:00') });

    expect(await sessions.extend(db, id, at('2026-10-27T10:40'))).toBe(at('2026-10-27T10:55'));
  });

  it('refuses a session that has ended', async () => {
    const id = await sessions.start(db, { vehicle_id: myvi, started_at: 1000 });
    await sessions.end(db, id, { ended_at: 2000 });

    await expect(sessions.extend(db, id, 3000)).rejects.toThrow('already ended');
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

  it('leaves parked cars out of the ended sessions', async () => {
    const ended = await sessions.start(db, { vehicle_id: myvi, started_at: 1000 });
    await sessions.end(db, ended, { ended_at: 1500 });
    const axia = await vehicles.add(db, { name: 'Axia' });
    await sessions.start(db, { vehicle_id: axia, started_at: 2000 });

    expect((await sessions.listHistory(db)).map((s) => s.id)).toEqual([ended]);
  });

  // Spending and the Sessions screen add up every session, so none may be cut.
  it('returns every session with limit null, past the default of 200', async () => {
    for (let i = 0; i < 201; i += 1) {
      await sessions.create(db, { vehicle_id: myvi, status: 'ended', started_at: i, ended_at: i + 1 });
    }

    expect(await sessions.listHistory(db)).toHaveLength(200);
    expect(await sessions.listHistory(db, { limit: null })).toHaveLength(201);
  });

  it('includes the place name in the details', async () => {
    const place = await places.create(db, { name: 'Pavilion Bukit Jalil' });
    const id = await sessions.create(db, { vehicle_id: myvi, place_id: place, status: 'active', started_at: 1000 });

    expect(await sessions.getDetails(db, id)).toMatchObject({
      vehicle_name: 'My Myvi',
      place_name: 'Pavilion Bukit Jalil',
    });
  });

  it('keeps the place name of a session whose place was deleted', async () => {
    const id = await sessions.start(db, { vehicle_id: myvi, place_name: 'Pavilion', started_at: 1000 });
    await places.remove(db, (await sessions.get(db, id)).place_id);

    expect((await sessions.listActive(db))[0].place_name).toBe('Pavilion');
    await sessions.end(db, id, { ended_at: 2000 });
    expect((await sessions.getDetails(db, id)).place_name).toBe('Pavilion');
    expect((await sessions.listHistory(db))[0].place_name).toBe('Pavilion');
  });

  it('returns null details for a deleted session', async () => {
    const id = await sessions.start(db, { vehicle_id: myvi });
    await sessions.remove(db, id);

    expect(await sessions.getDetails(db, id)).toBeNull();
  });
});

describe('sessions.listHistory filters', () => {
  let axia;
  let ids;
  beforeEach(async () => {
    axia = await vehicles.add(db, { name: 'Axia' });
    const park = async (key, vehicle_id, place_name, started_at) => {
      const id = await sessions.start(db, { vehicle_id, place_name, started_at });
      await sessions.end(db, id, { ended_at: started_at + 60000 });
      return [key, id];
    };
    ids = Object.fromEntries([
      await park('myviPavilion', myvi, 'Pavilion', at('2026-09-30T10:00')),
      await park('axiaPavilion', axia, 'Pavilion', at('2026-10-01T00:00')),
      await park('myviNoPlace', myvi, null, at('2026-10-15T10:00')),
      await park('axiaMidValley', axia, 'Mid Valley', at('2026-11-01T00:00')),
    ]);
  });

  it.each([
    { filter: 'car', options: () => ({ vehicle_id: axia }), keys: ['axiaMidValley', 'axiaPavilion'] },
    { filter: 'no place', options: () => ({ place_id: null }), keys: ['myviNoPlace'] },
    {
      filter: 'month, its first moment in and the next month out',
      options: () => ({ from: at('2026-10-01T00:00'), to: at('2026-11-01T00:00') }),
      keys: ['myviNoPlace', 'axiaPavilion'],
    },
  ])('filters by $filter', async ({ options, keys }) => {
    const rows = await sessions.listHistory(db, options());

    expect(rows.map((s) => s.id)).toEqual(keys.map((key) => ids[key]));
  });

  it('filters by place', async () => {
    const pavilion = await places.findByName(db, 'Pavilion');

    const rows = await sessions.listHistory(db, { place_id: pavilion.id });

    expect(rows.map((s) => s.id)).toEqual([ids.axiaPavilion, ids.myviPavilion]);
  });
});
