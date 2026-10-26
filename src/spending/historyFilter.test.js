import {
  filterChoices,
  filterHistory,
  historyFilters,
  isFiltered,
  liveFilter,
  NO_FILTER,
  NO_PLACE,
} from './historyFilter';

// Local phone time (jest.config.js pins Asia/Kuala_Lumpur).
const at = (localDateTime) => new Date(localDateTime).getTime();

const CARS = { myvi: 'My Myvi', axia: 'Axia' };
// Lower and upper case mixed, so only a sort that ignores case passes.
const PLACES = { pavilion: 'Pavilion Bukit Jalil', sunway: 'sunway Pyramid', old: 'old Mall' };

// A row as sessions.listHistory gives it; start in epoch ms, money in sen.
function session(id, { vehicle = 'myvi', place = 'pavilion', placeName, start, fee = 300, paid = null }) {
  return {
    id,
    vehicle_id: vehicle,
    vehicle_name: CARS[vehicle],
    place_id: place,
    place_name: place ? (placeName ?? PLACES[place]) : null,
    started_at: start,
    ended_at: start + 60 * 60 * 1000,
    fee_sen: fee,
    paid_sen: paid,
  };
}

// Newest first, as History loads them. 'old' is a deleted place: its
// sessions keep its name.
const ROWS = [
  session('s1', { start: at('2026-10-24T14:00') }),
  session('s2', { vehicle: 'axia', place: 'sunway', start: at('2026-10-20T10:00'), fee: 500, paid: 400 }),
  session('s3', { place: null, start: at('2026-10-02T09:00'), fee: null }),
  session('s4', { start: at('2026-09-28T18:00'), fee: 700 }),
  // 16:30 UTC on 31 August is 00:30 on 1 September in Malaysia.
  session('s5', { vehicle: 'axia', start: Date.parse('2026-08-31T16:30Z') }),
  session('s6', { place: 'old', start: at('2026-08-15T12:00'), fee: 200 }),
];

const ids = (rows) => rows.map((row) => row.id);

describe('filterHistory', () => {
  it('keeps every row, in order, with no filter', () => {
    expect(ids(filterHistory(ROWS, NO_FILTER))).toEqual(['s1', 's2', 's3', 's4', 's5', 's6']);
  });

  it('keeps one car', () => {
    expect(ids(filterHistory(ROWS, { ...NO_FILTER, vehicle: 'axia' }))).toEqual(['s2', 's5']);
  });

  it('keeps one place', () => {
    expect(ids(filterHistory(ROWS, { ...NO_FILTER, place: 'pavilion' }))).toEqual(['s1', 's4', 's5']);
  });

  it('keeps the sessions with no place for NO_PLACE', () => {
    expect(ids(filterHistory(ROWS, { ...NO_FILTER, place: NO_PLACE }))).toEqual(['s3']);
  });

  it('keeps the local month a session started in, not the UTC one', () => {
    expect(ids(filterHistory(ROWS, { ...NO_FILTER, month: '2026-09' }))).toEqual(['s4', 's5']);
    expect(ids(filterHistory(ROWS, { ...NO_FILTER, month: '2026-08' }))).toEqual(['s6']);
  });

  it('keeps only the rows that pass every filter', () => {
    expect(ids(filterHistory(ROWS, { vehicle: 'myvi', place: 'pavilion', month: '2026-10' }))).toEqual(['s1']);
  });
});

describe('isFiltered', () => {
  it('is false with no filter', () => {
    expect(isFiltered(NO_FILTER)).toBe(false);
  });

  it('is true with any one filter', () => {
    expect(isFiltered({ ...NO_FILTER, month: '2026-10' })).toBe(true);
  });
});

describe('liveFilter', () => {
  it('gives the same filter back when rows still have every choice', () => {
    const filter = { vehicle: 'axia', place: 'sunway', month: '2026-10' };

    expect(liveFilter(ROWS, filter)).toBe(filter);
  });

  it('sets a choice no row has any more back to all', () => {
    // The last session at a place was deleted on Find.
    expect(liveFilter(ROWS, { ...NO_FILTER, place: 'gone', month: '2026-10' })).toEqual({
      ...NO_FILTER,
      month: '2026-10',
    });
  });
});

describe('filterChoices', () => {
  it('lists a filter from the rows that pass the other filters, with all beside them', () => {
    expect(filterChoices(ROWS, { ...NO_FILTER, place: 'pavilion' }, 'vehicle')).toEqual({
      all: 3,
      options: [
        { value: 'axia', name: 'Axia', sessions: 1 },
        { value: 'myvi', name: 'My Myvi', sessions: 2 },
      ],
    });
  });

  it('ignores its own choice, so the other choices stay listed', () => {
    const { options } = filterChoices(ROWS, { ...NO_FILTER, vehicle: 'axia' }, 'vehicle');

    expect(options.map((option) => option.value)).toEqual(['axia', 'myvi']);
  });

  it('lists places by name in any case, a deleted one by its kept name, and no place last', () => {
    const { options } = filterChoices(ROWS, NO_FILTER, 'place');

    expect(options.map((option) => [option.name, option.sessions])).toEqual([
      ['old Mall', 1],
      ['Pavilion Bukit Jalil', 3],
      ['sunway Pyramid', 1],
      [null, 1],
    ]);
    expect(options.at(-1).value).toBe(NO_PLACE);
  });

  it('lists places with the same name in id order, so the list does not jump between loads', () => {
    const rows = [
      session('n1', { place: 'mall-b', placeName: 'Mall', start: at('2026-10-02T10:00') }),
      session('n2', { place: 'mall-a', placeName: 'mall', start: at('2026-10-01T10:00') }),
    ];

    expect(filterChoices(rows, NO_FILTER, 'place').options.map((option) => option.value)).toEqual([
      'mall-a',
      'mall-b',
    ]);
  });

  it('lists months newest first', () => {
    const { options } = filterChoices(ROWS, NO_FILTER, 'month');

    expect(options.map((option) => [option.value, option.sessions])).toEqual([
      ['2026-10', 3],
      ['2026-09', 2],
      ['2026-08', 1],
    ]);
  });

  it('keeps the choice made, with no sessions, when the other filters leave it none', () => {
    // Axia never parked without a place.
    const { options } = filterChoices(ROWS, { ...NO_FILTER, vehicle: 'axia', place: NO_PLACE }, 'place');

    expect(options).toEqual([
      { value: 'pavilion', name: 'Pavilion Bukit Jalil', sessions: 1 },
      { value: 'sunway', name: 'sunway Pyramid', sessions: 1 },
      { value: NO_PLACE, name: null, sessions: 0 },
    ]);
  });
});

describe('historyFilters', () => {
  it('totals the rows kept, with the amount paid when there is one and nothing for no fee', () => {
    const { rows, total } = historyFilters(ROWS, { ...NO_FILTER, month: '2026-10' });

    expect(ids(rows)).toEqual(['s1', 's2', 's3']);
    expect(total).toEqual({ totalSen: 700, sessions: 3 });
  });

  it('gives the chosen option for each filter, or null', () => {
    const { choices } = historyFilters(ROWS, { ...NO_FILTER, place: 'sunway' });

    expect(choices.place.selected).toEqual({ value: 'sunway', name: 'sunway Pyramid', sessions: 1 });
    expect(choices.vehicle.selected).toBeNull();
  });

  it('drops a choice no row has any more', () => {
    const { filter, rows } = historyFilters(ROWS, { ...NO_FILTER, vehicle: 'sold' });

    expect(filter).toEqual(NO_FILTER);
    expect(rows).toHaveLength(ROWS.length);
  });

  it('hides a filter that the whole history gives one choice for', () => {
    const oneCar = ROWS.filter((row) => row.vehicle_id === 'myvi');

    expect(historyFilters(oneCar, NO_FILTER).choices.vehicle.show).toBe(false);
    expect(historyFilters(oneCar, NO_FILTER).choices.place.show).toBe(true);
  });

  it('counts the choices over the whole history, not only the rows shown', () => {
    // August has only the Myvi, but the history has two cars.
    expect(historyFilters(ROWS, { ...NO_FILTER, month: '2026-08' }).choices.vehicle.show).toBe(true);
  });

  it('still shows a filter with one choice while it is chosen, so it can be cleared', () => {
    const oneCar = ROWS.filter((row) => row.vehicle_id === 'myvi');

    expect(historyFilters(oneCar, { ...NO_FILTER, vehicle: 'myvi' }).choices.vehicle.show).toBe(true);
  });

  it('shows no filter for an empty history', () => {
    const { rows, choices } = historyFilters([], NO_FILTER);

    expect(rows).toEqual([]);
    expect(Object.values(choices).map((choice) => choice.show)).toEqual([false, false, false]);
  });
});
