import { ownerName, sessionsFilter } from './sessionsFilter';

// Local phone time (jest.config.js pins Asia/Kuala_Lumpur).
const at = (localDateTime) => new Date(localDateTime).getTime();
const OCTOBER = { from: at('2026-10-01T00:00'), to: at('2026-11-01T00:00') };

describe('sessionsFilter', () => {
  it('lists one place in the month', () => {
    expect(sessionsFilter({ month: '2026-10', placeId: 'pavilion' })).toEqual({
      filter: { month: '2026-10', kind: 'place', id: 'pavilion', query: { ...OCTOBER, place_id: 'pavilion' } },
      error: null,
    });
  });

  it('reads placeId none as the sessions with no place', () => {
    const { filter } = sessionsFilter({ month: '2026-10', placeId: 'none' });

    expect(filter.id).toBeNull();
    expect(filter.query).toEqual({ ...OCTOBER, place_id: null });
  });

  it('lists one car in the month', () => {
    expect(sessionsFilter({ month: '2026-10', vehicleId: 'myvi' }).filter).toEqual({
      month: '2026-10',
      kind: 'vehicle',
      id: 'myvi',
      query: { ...OCTOBER, vehicle_id: 'myvi' },
    });
  });

  it.each([
    { rule: 'no month', params: { placeId: 'pavilion' } },
    { rule: 'month 13', params: { month: '2026-13', placeId: 'pavilion' } },
    { rule: 'a date instead of a month', params: { month: '2026-10-01', placeId: 'pavilion' } },
    // A list, as a repeated param gives: ['2026-10'] would pass the month
    // pattern once turned into text, so only the string check refuses it.
    { rule: 'a month given as a list', params: { month: ['2026-10'], placeId: 'pavilion' } },
  ])('refuses $rule', ({ params }) => {
    expect(sessionsFilter(params)).toEqual({ filter: null, error: 'This list has no month to show.' });
  });

  it.each([
    { rule: 'neither a place nor a car', params: { month: '2026-10' } },
    { rule: 'both a place and a car', params: { month: '2026-10', placeId: 'pavilion', vehicleId: 'myvi' } },
    { rule: 'an empty place', params: { month: '2026-10', placeId: '' } },
  ])('refuses $rule', ({ params }) => {
    expect(sessionsFilter(params)).toEqual({ filter: null, error: 'This list needs a place or a car.' });
  });
});

describe('ownerName', () => {
  const place = sessionsFilter({ month: '2026-10', placeId: 'pavilion' }).filter;
  const car = sessionsFilter({ month: '2026-10', vehicleId: 'myvi' }).filter;

  it('calls the sessions with no place "No place"', () => {
    expect(ownerName(sessionsFilter({ month: '2026-10', placeId: 'none' }).filter, [], null)).toBe('No place');
  });

  it("takes the name from the sessions, which keep a deleted place's name", () => {
    expect(ownerName(place, [{ place_name: 'Old Mall', vehicle_name: 'My Myvi' }], null)).toBe('Old Mall');
  });

  it('takes the car name for a car list', () => {
    expect(ownerName(car, [{ place_name: 'Old Mall', vehicle_name: 'My Myvi' }], null)).toBe('My Myvi');
  });

  it('falls back to the place or car row when the list is empty', () => {
    expect(ownerName(car, [], { name: 'Wife’s Axia' })).toBe('Wife’s Axia');
  });

  it('gives null when the name is not known', () => {
    expect(ownerName(place, [], null)).toBeNull();
  });
});
