import { burstPoints, countUpAt, easeOutCubic, homeCarMove } from './motion';

describe('homeCarMove', () => {
  const look = (changes) => ({ carId: 'myvi', parked: false, foundAt: undefined, foundCarId: undefined, ...changes });

  it('moves nothing on the first look', () => {
    expect(homeCarMove(null, look({ parked: true }))).toBeNull();
  });

  it('drives in when the car has just been parked', () => {
    expect(homeCarMove(look(), look({ parked: true }))).toBe('in');
  });

  it('drives off when Found my car has just ended this car', () => {
    const before = look({ parked: true });

    expect(homeCarMove(before, look({ foundAt: '1000', foundCarId: 'myvi' }))).toBe('off');
  });

  it('drives off even if the data has not reloaded yet', () => {
    const before = look({ parked: true });

    expect(homeCarMove(before, look({ parked: true, foundAt: '1000', foundCarId: 'myvi' }))).toBe('off');
  });

  it('moves nothing when a parked session is deleted', () => {
    expect(homeCarMove(look({ parked: true }), look())).toBeNull();
  });

  it('drives off only once for the same Found my car', () => {
    const found = look({ foundAt: '1000', foundCarId: 'myvi' });

    expect(homeCarMove(found, found)).toBeNull();
  });

  it('moves nothing when another car was found', () => {
    expect(homeCarMove(look({ parked: true }), look({ parked: true, foundAt: '1000', foundCarId: 'axia' }))).toBeNull();
  });

  it('moves nothing when switching cars', () => {
    expect(homeCarMove(look(), look({ carId: 'axia', parked: true }))).toBeNull();
  });

  it('drives in again when the found car is parked again', () => {
    const found = look({ foundAt: '1000', foundCarId: 'myvi' });

    expect(homeCarMove(found, { ...found, parked: true })).toBe('in');
  });
});

describe('easeOutCubic', () => {
  it('starts at 0, ends at 1 and is past halfway at the middle', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(0.5)).toBeCloseTo(0.875);
  });
});

describe('countUpAt', () => {
  it('counts from 0 to the target in whole numbers', () => {
    expect(countUpAt(1250, 0, 600)).toBe(0);
    expect(countUpAt(1250, 300, 600)).toBe(1094);
    expect(countUpAt(1250, 600, 600)).toBe(1250);
  });

  it('stops at the target after the duration', () => {
    expect(countUpAt(1250, 5000, 600)).toBe(1250);
  });

  it('shows the target at once when there is no duration', () => {
    expect(countUpAt(1250, 0, 0)).toBe(1250);
  });

  it('treats a clock that went backwards as the start', () => {
    expect(countUpAt(1250, -50, 600)).toBe(0);
  });
});

describe('burstPoints', () => {
  it('gives one point per particle, the first straight up', () => {
    const points = burstPoints(8, 100);

    expect(points).toHaveLength(8);
    expect(points[0]).toEqual({ x: 0, y: -100 });
  });

  it('puts every other point closer in', () => {
    const [, second] = burstPoints(4, 100);

    expect(Math.hypot(second.x, second.y)).toBeCloseTo(70, 0);
  });
});
