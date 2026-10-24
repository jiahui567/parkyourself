// Scroll wheel arithmetic (the timer wheel), kept out of the component so it
// can be tested.

// The row in the middle of a wheel scrolled offsetY down, rows rowHeight
// tall: the nearest one, never past either end.
export function wheelIndexAt(offsetY, rowHeight, count) {
  return Math.min(count - 1, Math.max(0, Math.round(offsetY / rowHeight)));
}

// The index of value in values, or of the nearest value when it is not one.
export function nearestIndex(values, value) {
  let best = 0;
  values.forEach((candidate, i) => {
    if (Math.abs(candidate - value) < Math.abs(values[best] - value)) best = i;
  });
  return best;
}
