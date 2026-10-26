import { filterByQuery } from './placeSearch';

const PYRAMID = { id: 'sunway-pyramid', name: 'Sunway Pyramid', area: 'Bandar Sunway' };
const MID_VALLEY = { id: 'mid-valley', name: 'Mid Valley Megamall', area: null };
const OFFICE = { id: 'p1', name: 'Office basement', visits: 12 };

describe('filterByQuery', () => {
  it('keeps every row for an empty or blank query', () => {
    expect(filterByQuery([PYRAMID, OFFICE], '')).toEqual([PYRAMID, OFFICE]);
    expect(filterByQuery([PYRAMID, OFFICE], '   ')).toEqual([PYRAMID, OFFICE]);
    expect(filterByQuery([PYRAMID, OFFICE], undefined)).toEqual([PYRAMID, OFFICE]);
  });

  it('finds part of a name, in any case, ignoring spaces around the query', () => {
    expect(filterByQuery([PYRAMID, MID_VALLEY, OFFICE], ' VALLEY ')).toEqual([MID_VALLEY]);
    expect(filterByQuery([PYRAMID, MID_VALLEY, OFFICE], 'base')).toEqual([OFFICE]);
  });

  it('also finds a car park by its area', () => {
    expect(filterByQuery([PYRAMID, MID_VALLEY], 'bandar')).toEqual([PYRAMID]);
  });

  it('finds nothing when no name or area has the query', () => {
    expect(filterByQuery([PYRAMID, MID_VALLEY, OFFICE], 'pavilion')).toEqual([]);
  });
});
