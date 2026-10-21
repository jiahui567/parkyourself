import { ZONE_COLOURS, hexToColourName, swatchFor, textColourOn } from './zoneColour';

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
