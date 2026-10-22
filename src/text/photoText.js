// 'Photo 2 of 3', for screen readers and the photo viewer. index starts at 0.
export function photoLabel(index, count) {
  return `Photo ${index + 1} of ${count}`;
}

// The camera button on Park and Find: the first photo is the pillar sign, the
// rest are extra.
export function addPhotoLabel(count) {
  return count === 0 ? 'Take photo' : 'Add photo';
}
