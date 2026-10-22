import { addPhotoLabel, photoLabel } from './photoText';

describe('photoLabel', () => {
  it('counts from 1 for people', () => {
    expect(photoLabel(0, 3)).toBe('Photo 1 of 3');
    expect(photoLabel(2, 3)).toBe('Photo 3 of 3');
  });
});

describe('addPhotoLabel', () => {
  it('asks for the first photo, then for more', () => {
    expect(addPhotoLabel(0)).toBe('Take photo');
    expect(addPhotoLabel(1)).toBe('Add photo');
  });
});
