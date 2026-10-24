import { nearestIndex, wheelIndexAt } from './wheel';

describe('wheelIndexAt', () => {
  it('picks the row nearest the middle', () => {
    expect(wheelIndexAt(0, 44, 24)).toBe(0);
    expect(wheelIndexAt(88, 44, 24)).toBe(2);
    expect(wheelIndexAt(110, 44, 24)).toBe(3);
    expect(wheelIndexAt(105, 44, 24)).toBe(2);
  });

  it('stops at both ends when the list bounces past them', () => {
    expect(wheelIndexAt(-30, 44, 24)).toBe(0);
    expect(wheelIndexAt(5000, 44, 24)).toBe(23);
  });
});

describe('nearestIndex', () => {
  const minutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

  it('finds a value on the wheel', () => {
    expect(nearestIndex(minutes, 30)).toBe(6);
  });

  it('finds the nearest row for a value between rows', () => {
    expect(nearestIndex(minutes, 32)).toBe(6);
    expect(nearestIndex(minutes, 59)).toBe(11);
  });
});
