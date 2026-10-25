import { openMigratedTestDatabase } from '../../test/testDatabase';
import { assertCarParkList, carParks } from './carParks';
import { places } from './places';

let db;
beforeEach(async () => {
  db = await openMigratedTestDatabase();
});
afterEach(() => db.close());

const TODAY = '2026-10-24';
const hourly = (day_type, effective_from, first_sen) => ({
  day_type,
  effective_from,
  type: 'hourly',
  first_minutes: 60,
  first_sen,
  block_minutes: 60,
  block_sen: 200,
  grace_minutes: 15,
  daily_cap_sen: null,
});
const PYRAMID = {
  id: 'sunway-pyramid',
  name: 'Sunway Pyramid',
  area: 'Bandar Sunway',
  lat: 3.0728,
  lng: 101.6069,
  source_url: 'https://example.com/pyramid',
  checked_on: '2026-10-24',
  rates: [
    hourly('weekday', null, 200),
    hourly('weekday', '2025-01-01', 300),
    hourly('weekend', '2025-01-01', 400),
    { day_type: 'holiday', effective_from: null, type: 'flat', flat_sen: 800 },
  ],
};
const VELOCITY = {
  id: 'sunway-velocity-mall',
  name: 'Sunway Velocity Mall',
  lat: 3.1279,
  lng: 101.7238,
  source_url: 'https://example.com/velocity',
  checked_on: '2026-10-24',
  rates: [hourly('weekday', null, 300)],
};
const LIST = { version: '2026-10-24', carParks: [PYRAMID, VELOCITY] };

describe('carParks.refresh and get', () => {
  it('stores the list and gives the rates in effect today', async () => {
    expect(await carParks.refresh(db, LIST)).toBe(true);

    const stored = await carParks.get(db, 'sunway-pyramid', TODAY);
    expect(stored).toMatchObject({ name: 'Sunway Pyramid', checked_on: '2026-10-24', effective_from: '2025-01-01' });
    expect(stored.rates.weekday).toMatchObject({ type: 'hourly', first_sen: 300, block_sen: 200, grace_minutes: 15 });
    expect(stored.rates.weekend.first_sen).toBe(400);
    expect(stored.rates.holiday).toMatchObject({ type: 'flat', flat_sen: 800 });
  });

  it('keeps the older rate for a day before the change', async () => {
    await carParks.refresh(db, LIST);

    expect((await carParks.get(db, 'sunway-pyramid', '2024-12-31')).rates.weekday.first_sen).toBe(200);
  });

  it('leaves the stored list alone when nothing changed', async () => {
    await carParks.refresh(db, LIST);

    expect(await carParks.refresh(db, LIST)).toBe(false);
  });

  it('replaces the list when its content changed but the version did not', async () => {
    await carParks.refresh(db, LIST);

    expect(await carParks.refresh(db, { ...LIST, carParks: [VELOCITY] })).toBe(true);
    expect(await carParks.get(db, 'sunway-pyramid', TODAY)).toBeNull();
  });

  it('never lets the built-in copy replace a downloaded list', async () => {
    await carParks.refresh(db, { version: 'server', carParks: [VELOCITY] }, 'server');

    expect(await carParks.refresh(db, LIST, 'bundled')).toBe(false);
    expect(await carParks.get(db, 'sunway-pyramid', TODAY)).toBeNull();
    expect((await carParks.info(db)).source).toBe('server');
  });

  it('lets a new download replace the last one', async () => {
    await carParks.refresh(db, { version: 'server', carParks: [VELOCITY] }, 'server');

    expect(await carParks.refresh(db, { version: 'server', carParks: [PYRAMID] }, 'server')).toBe(true);
    expect(await carParks.get(db, 'sunway-pyramid', TODAY)).not.toBeNull();
  });

  it('stores nothing from a list with a bad rate', async () => {
    const bad = { ...PYRAMID, rates: [hourly('holiday', null, 300)] };

    await expect(carParks.refresh(db, { version: 'x', carParks: [VELOCITY, bad] })).rejects.toThrow(
      'Car park sunway-pyramid, holiday from the start'
    );
    expect(await carParks.get(db, 'sunway-velocity-mall', TODAY)).toBeNull();
  });
});

describe('carParks.refreshAtStart and info', () => {
  // The failure is logged as well as kept; keep the test output quiet.
  beforeEach(() => jest.spyOn(console, 'warn').mockImplementation(() => {}));
  afterEach(() => console.warn.mockRestore());

  it('stores the list and clears an earlier error', async () => {
    await carParks.refreshAtStart(db, { version: 'x', carParks: [{ ...VELOCITY, source_url: '' }] });
    await carParks.refreshAtStart(db, LIST);

    expect(await carParks.info(db)).toEqual({ source: 'bundled', carParks: 2, rates: 5, error: null });
  });

  it('keeps an earlier download error when the start changes nothing', async () => {
    await carParks.refreshAtStart(db, LIST);
    await carParks.setLastError(db, 'Download: Network request failed');

    await carParks.refreshAtStart(db, LIST);

    expect((await carParks.info(db)).error).toBe('Download: Network request failed');
  });

  it('keeps the list it had and the error, instead of failing the start', async () => {
    await carParks.refreshAtStart(db, LIST);

    await carParks.refreshAtStart(db, { version: 'x', carParks: [{ ...VELOCITY, source_url: '' }] });

    expect(await carParks.get(db, 'sunway-pyramid', TODAY)).not.toBeNull();
    expect((await carParks.info(db)).error).toMatch('needs a source_url');
  });
});

describe('assertCarParkList', () => {
  it.each([
    ['a missing version', { carParks: [] }, 'needs a version'],
    ['a repeated id', { version: 'x', carParks: [VELOCITY, VELOCITY] }, 'listed twice'],
    ['no source', { version: 'x', carParks: [{ ...VELOCITY, source_url: '' }] }, 'needs a source_url'],
    [
      'a bad date',
      { version: 'x', carParks: [{ ...VELOCITY, rates: [hourly('weekday', 'Jan 2025', 300)] }] },
      'YYYY-MM-DD',
    ],
    [
      'the same rate twice, once without a date and once with null',
      {
        version: 'x',
        carParks: [{ ...VELOCITY, rates: [{ ...hourly('weekday', null, 300), effective_from: undefined }, hourly('weekday', null, 400)] }],
      },
      'listed twice',
    ],
    [
      'the same rate twice',
      { version: 'x', carParks: [{ ...VELOCITY, rates: [hourly('weekday', null, 300), hourly('weekday', null, 400)] }] },
      'listed twice',
    ],
  ])('refuses %s', (_, list, message) => {
    expect(() => assertCarParkList(list)).toThrow(message);
  });
});

describe('carParks.search, listLocated and findByName', () => {
  beforeEach(() => carParks.refresh(db, LIST));

  it('finds listed car parks by part of the name, in any case', async () => {
    expect((await carParks.search(db, 'SUNWAY')).map((c) => c.id)).toEqual(['sunway-pyramid', 'sunway-velocity-mall']);
    expect((await carParks.search(db, 'pyr')).map((c) => c.id)).toEqual(['sunway-pyramid']);
  });

  it('treats % in the search as itself', async () => {
    expect(await carParks.search(db, '%')).toEqual([]);
  });

  it('leaves a car park already saved as a place out of the search', async () => {
    await places.create(db, { name: 'sunway pyramid' });

    expect((await carParks.search(db, 'sunway')).map((c) => c.id)).toEqual(['sunway-velocity-mall']);
  });

  it('also finds a car park by its area', async () => {
    expect((await carParks.search(db, 'bandar sunway')).map((c) => c.id)).toEqual(['sunway-pyramid']);
  });

  it('lists the located ones for the location, with the saved place of the same name', async () => {
    const placeId = await places.create(db, { name: 'sunway pyramid' });

    expect(await carParks.listLocated(db)).toEqual([
      { id: 'sunway-pyramid', name: 'Sunway Pyramid', lat: 3.0728, lng: 101.6069, place_id: placeId, place_name: 'sunway pyramid' },
      { id: 'sunway-velocity-mall', name: 'Sunway Velocity Mall', lat: 3.1279, lng: 101.7238, place_id: null, place_name: null },
    ]);
  });

  it('finds a listed car park by its exact name, in any case', async () => {
    expect((await carParks.findByName(db, ' SUNWAY PYRAMID ', TODAY)).rates.weekday.first_sen).toBe(300);
    expect(await carParks.findByName(db, 'Sunway', TODAY)).toBeNull();
  });
});

describe('carParks.replaceReports and pendingReports', () => {
  const FLAT = { type: 'flat', first_minutes: null, first_sen: null, block_minutes: null, block_sen: null, grace_minutes: 0, daily_cap_sen: null, flat_sen: 500 };
  const report = (id, car_park_id, reported_at) => ({
    id,
    car_park_id,
    rates: { weekday: null, weekend: FLAT, holiday: null },
    reported_at,
  });

  beforeEach(async () => {
    await carParks.refresh(db, LIST);
  });

  it('stores the reports, newest first for each car park, with the car park', async () => {
    await carParks.replaceReports(db, [report('r1', 'sunway-pyramid', 1000), report('r2', 'sunway-pyramid', 2000)]);

    expect((await carParks.pendingReports(db, 'sunway-pyramid')).map((r) => r.id)).toEqual(['r2', 'r1']);
    const stored = await carParks.get(db, 'sunway-pyramid', TODAY);
    expect(stored.reports[0]).toEqual(report('r2', 'sunway-pyramid', 2000));
    expect((await carParks.get(db, 'sunway-velocity-mall', TODAY)).reports).toEqual([]);
  });

  it('replaces the reports stored before, so reviewed ones go', async () => {
    await carParks.replaceReports(db, [report('r1', 'sunway-pyramid', 1000)]);

    await carParks.replaceReports(db, [report('r3', 'sunway-velocity-mall', 3000)]);

    expect(await carParks.pendingReports(db, 'sunway-pyramid')).toEqual([]);
    expect((await carParks.pendingReports(db, 'sunway-velocity-mall')).map((r) => r.id)).toEqual(['r3']);
  });

  it('leaves out a report about a car park the phone does not have', async () => {
    await carParks.replaceReports(db, [report('r1', 'not-listed', 1000), report('r2', 'sunway-pyramid', 2000)]);

    const { n } = await db.getFirstAsync('SELECT COUNT(*) AS n FROM car_park_report');
    expect(n).toBe(1);
  });

  it('drops the reports of a car park the list no longer has', async () => {
    await carParks.replaceReports(db, [report('r1', 'sunway-velocity-mall', 1000)]);

    await carParks.refresh(db, { version: 'next', carParks: [PYRAMID] });

    expect(await carParks.pendingReports(db, 'sunway-velocity-mall')).toEqual([]);
  });
});
