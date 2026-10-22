// '1 visit', '3 visits': how many times a car was parked at a place, as the
// Places list shows it.
export function visitsText(count) {
  if (!Number.isInteger(count) || count < 0) throw new Error(`Visits must be a whole number of 0 or more, got ${count}`);
  return count === 1 ? '1 visit' : `${count} visits`;
}
