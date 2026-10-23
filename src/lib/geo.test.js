import { distanceMetres, isUsableReading, moreAccurate, nearestPlace, NEARBY_M, USABLE_ACCURACY_M } from './geo';

// Two Kuala Lumpur malls about 1.3 km apart, and a point about 100 m north of
// the first (0.0009 degrees of latitude).
const VELOCITY = { id: 'v', name: 'Sunway Velocity', lat: 3.1279, lng: 101.7238 };
const MYTOWN = { id: 'm', name: 'MyTown', lat: 3.1165, lng: 101.7244 };
const NEAR_VELOCITY = { lat: 3.1288, lng: 101.7238, accuracyM: 15 };

describe('distanceMetres', () => {
  it('is zero for the same point', () => {
    expect(distanceMetres(VELOCITY, VELOCITY)).toBe(0);
  });

  it('measures 0.0009 degrees of latitude as about 100 m', () => {
    expect(distanceMetres(VELOCITY, NEAR_VELOCITY)).toBeCloseTo(100, -1);
  });

  it('measures between two malls in kilometres', () => {
    expect(distanceMetres(VELOCITY, MYTOWN)).toBeGreaterThan(1200);
    expect(distanceMetres(VELOCITY, MYTOWN)).toBeLessThan(1300);
  });
});

describe('isUsableReading', () => {
  it.each([
    { rule: 'a precise reading is usable', reading: { lat: 3, lng: 101, accuracyM: 12 }, usable: true },
    { rule: 'the limit itself is usable', reading: { lat: 3, lng: 101, accuracyM: USABLE_ACCURACY_M }, usable: true },
    { rule: 'a rough reading is not', reading: { lat: 3, lng: 101, accuracyM: USABLE_ACCURACY_M + 1 }, usable: false },
    { rule: 'a reading without accuracy is not', reading: { lat: 3, lng: 101, accuracyM: null }, usable: false },
    { rule: 'no reading is not', reading: null, usable: false },
  ])('$rule', ({ reading, usable }) => {
    expect(isUsableReading(reading)).toBe(usable);
  });
});

describe('moreAccurate', () => {
  const rough = { lat: 3, lng: 101, accuracyM: 80 };
  const precise = { lat: 3.1, lng: 101.1, accuracyM: 10 };

  it('keeps the smaller accuracy radius, whichever comes first', () => {
    expect(moreAccurate(rough, precise)).toBe(precise);
    expect(moreAccurate(precise, rough)).toBe(precise);
  });

  it('keeps the one there is', () => {
    expect(moreAccurate(null, rough)).toBe(rough);
    expect(moreAccurate(rough, null)).toBe(rough);
    expect(moreAccurate(null, null)).toBeNull();
  });
});

describe('nearestPlace', () => {
  it('finds the saved place near the reading', () => {
    expect(nearestPlace([MYTOWN, VELOCITY], NEAR_VELOCITY)).toBe(VELOCITY);
  });

  it('picks the closer of two nearby places', () => {
    const across = { id: 'a', name: 'Across the road', lat: 3.1291, lng: 101.7238 };

    expect(nearestPlace([VELOCITY, across], NEAR_VELOCITY)).toBe(across);
  });

  it(`finds nothing farther than ${NEARBY_M} m`, () => {
    expect(nearestPlace([MYTOWN], NEAR_VELOCITY)).toBeNull();
  });

  it('skips places with no location', () => {
    expect(nearestPlace([{ id: 'x', name: 'No pin', lat: null, lng: null }], NEAR_VELOCITY)).toBeNull();
  });

  it('does not guess from a rough reading', () => {
    expect(nearestPlace([VELOCITY], { ...NEAR_VELOCITY, accuracyM: 900 })).toBeNull();
  });
});
