import { hexToColourName, isChromatic, signCropRect, swatchFor, textColourOn, ZONE_COLOURS } from './zoneColour';

describe('hexToColourName', () => {
  it.each([
    ['#1E5BD8', 'Blue'],
    ['#E53935', 'Red'],
    ['#FDD835', 'Yellow'],
    ['#43A047', 'Green'],
    ['#9E9E9E', 'Grey'],
  ])('PLAN.md test case %s -> %s', (hex, name) => {
    expect(hexToColourName(hex)).toBe(name);
  });

  it.each([
    ['#FFFFFF', 'White'],
    ['#111111', 'Black'],
    ['#FB8C00', 'Orange'],
    ['#7B4A1E', 'Brown'],
    ['#8E24AA', 'Purple'],
    ['#EC407A', 'Pink'],
  ])('%s -> %s', (hex, name) => {
    expect(hexToColourName(hex)).toBe(name);
  });

  it('accepts lower case and a missing #', () => {
    expect(hexToColourName('1e5bd8')).toBe('Blue');
  });

  it.each(['', 'blue', '#12345', '#GGGGGG', null])('rejects %p', (hex) => {
    expect(() => hexToColourName(hex)).toThrow('Not a hex colour');
  });
});

describe('ZONE_COLOURS', () => {
  it.each(ZONE_COLOURS)('the $name chip swatch is read back as $name', ({ name, swatch }) => {
    expect(hexToColourName(swatch)).toBe(name);
  });

  it('looks up a swatch by name', () => {
    expect(swatchFor('Blue')).toBe('#1E5BD8');
    expect(swatchFor('Teal')).toBeNull();
  });
});

describe('textColourOn', () => {
  it.each(['Yellow', 'White'])('uses dark text on %s', (name) => {
    expect(textColourOn(swatchFor(name))).toBe('#111111');
  });

  it.each(['Red', 'Green', 'Blue', 'Purple', 'Brown', 'Black'])('uses white text on %s', (name) => {
    expect(textColourOn(swatchFor(name))).toBe('#FFFFFF');
  });
});

describe('isChromatic', () => {
  it.each([
    ['Blue', true],
    ['Brown', true],
    ['Grey', false],
    ['White', false],
    ['Black', false],
    [null, false],
  ])('%s is %s', (name, chromatic) => {
    expect(isChromatic(name)).toBe(chromatic);
  });
});

describe('signCropRect', () => {
  const PHOTO = { width: 1280, height: 960 };

  it('widens the text box to take in the panel behind it', () => {
    expect(signCropRect({ x: 500, y: 300, width: 200, height: 100 }, PHOTO)).toEqual({
      originX: 440,
      originY: 240,
      width: 320,
      height: 220,
    });
  });

  it('keeps the crop inside the photo', () => {
    expect(signCropRect({ x: 10, y: 900, width: 100, height: 50 }, PHOTO)).toEqual({
      originX: 0,
      originY: 870,
      width: 140,
      height: 90,
    });
  });

  it('gives null for a box outside the photo', () => {
    expect(signCropRect({ x: 2000, y: 100, width: 100, height: 50 }, PHOTO)).toBeNull();
  });

  it('gives null without a usable box or size', () => {
    expect(signCropRect(null, PHOTO)).toBeNull();
    expect(signCropRect({ x: 0, y: 0, width: 0, height: 10 }, PHOTO)).toBeNull();
    expect(signCropRect({ x: 0, y: 0, width: 10, height: 10 }, null)).toBeNull();
  });
});
