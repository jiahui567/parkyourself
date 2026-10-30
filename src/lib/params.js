// A screen's query param as one string, or undefined. expo-router gives a key
// repeated in a link (?at=1&at=2) as an array, and a new one at every render,
// so in an effect's or a load's dependencies it would run again at every
// render. Links can come from outside the app (the parkyourself:// scheme).
export function oneParam(value) {
  return typeof value === 'string' ? value : undefined;
}
