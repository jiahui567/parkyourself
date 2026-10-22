// Which item to show after the one at index is removed from a list of count
// items: the item that moved into its place, or the new last one. null when
// the list is now empty (close the viewer).
export function indexAfterRemoval(index, count) {
  if (count <= 1) return null;
  return Math.min(index, count - 2);
}
