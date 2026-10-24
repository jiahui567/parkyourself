// Numbers behind the app's animations, kept out of the components so they can
// be tested.

// Fast at first, gentle at the end, like a car braking: t from 0 to 1.
export const easeOutCubic = (t) => 1 - (1 - t) ** 3;

// The whole number shown elapsedMs into counting from 0 up to target over
// durationMs. Money is integer sen, so the count stays whole.
export function countUpAt(target, elapsedMs, durationMs) {
  if (durationMs <= 0 || elapsedMs >= durationMs) return target;
  return Math.round(target * easeOutCubic(Math.max(0, elapsedMs) / durationMs));
}

// What the Home car drawing does between two looks at it, each
// { carId, parked, foundAt, foundCarId }: 'in' when this car has just been
// parked, 'off' when Found my car has just ended its parking (a new foundAt
// naming this car), otherwise null. Deleting a parked session also ends it,
// but without foundAt, so the car simply shows as not parked. Switching cars
// and the first look move nothing.
export function homeCarMove(before, now) {
  if (!before || before.carId !== now.carId) return null;
  if (now.foundAt && now.foundAt !== before.foundAt && now.foundCarId === now.carId) return 'off';
  if (now.parked && !before.parked) return 'in';
  return null;
}

// Where count particles end up when they burst from a point: evenly round a
// circle, starting straight up, every other one a little closer so the burst
// does not look like a ring. [{ x, y }] in pixels from the centre.
export function burstPoints(count, radius) {
  return Array.from({ length: count }, (_, i) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / count;
    const r = i % 2 === 0 ? radius : radius * 0.7;
    return { x: Math.round(r * Math.cos(angle)), y: Math.round(r * Math.sin(angle)) };
  });
}
