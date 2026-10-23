// Zone colours offered as chips on the Park screen, in display order. The
// swatch is only for drawing the chip; sessions store the name, and the hex
// read off the sign (photoColour.js) when there was one.
export const ZONE_COLOURS = [
  { name: 'Red', swatch: '#E53935' },
  { name: 'Orange', swatch: '#FB8C00' },
  { name: 'Yellow', swatch: '#FDD835' },
  { name: 'Green', swatch: '#43A047' },
  { name: 'Blue', swatch: '#1E5BD8' },
  { name: 'Purple', swatch: '#8E24AA' },
  { name: 'Pink', swatch: '#EC407A' },
  { name: 'Brown', swatch: '#7B4A1E' },
  { name: 'Grey', swatch: '#9E9E9E' },
  { name: 'White', swatch: '#FFFFFF' },
  { name: 'Black', swatch: '#111111' },
];

export function swatchFor(name) {
  return ZONE_COLOURS.find((c) => c.name === name)?.swatch ?? null;
}

// Dark text on light swatches (yellow, white), white text on the rest.
export function textColourOn(hex) {
  const value = parseInt(String(hex).replace('#', ''), 16);
  const luminance = 0.299 * ((value >> 16) & 255) + 0.587 * ((value >> 8) & 255) + 0.114 * (value & 255);
  return luminance > 160 ? '#111111' : '#FFFFFF';
}

// Nearest colour name for a hex such as '#1E5BD8', using the hue, saturation
// and lightness rules in PLAN.md ("Pillar zone colour").
export function hexToColourName(hex) {
  const match = /^#?([0-9a-f]{6})$/i.exec(String(hex ?? '').trim());
  if (!match) throw new Error(`Not a hex colour: ${hex}`);
  const value = parseInt(match[1], 16);
  const r = ((value >> 16) & 255) / 255;
  const g = ((value >> 8) & 255) / 255;
  const b = (value & 255) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const lightness = (max + min) / 2;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));

  if (saturation < 0.15) {
    if (lightness < 0.12) return 'Black';
    return lightness > 0.9 ? 'White' : 'Grey';
  }

  let hue;
  if (max === r) hue = 60 * (((g - b) / delta) % 6);
  else if (max === g) hue = 60 * ((b - r) / delta + 2);
  else hue = 60 * ((r - g) / delta + 4);
  if (hue < 0) hue += 360;

  if (hue >= 345 || hue < 15) return 'Red';
  if (hue < 45) return lightness < 0.35 ? 'Brown' : 'Orange';
  if (hue < 70) return 'Yellow';
  if (hue < 170) return 'Green';
  if (hue < 260) return 'Blue';
  if (hue < 300) return 'Purple';
  return 'Pink';
}

// Named colours too plain to tell a zone from bare concrete or a white light
// in a basement: a sampled one is kept as a hex but never suggested.
const PLAIN = ['White', 'Grey', 'Black'];

export function isChromatic(name) {
  return name != null && !PLAIN.includes(name);
}

const clamp = (value, max) => Math.min(Math.max(value, 0), max);

// The part of the photo to read the sign's colour from: the box of the text
// OCR found (in the photo's pixels), widened by most of its height on every
// side to take in the painted panel behind the letters, kept inside the photo
// ({ width, height }). An ImageManipulator crop rect, or null when nothing of
// the box is left inside the photo.
export function signCropRect(box, size) {
  if (!box || !(box.width > 0) || !(box.height > 0) || !(size?.width > 0) || !(size?.height > 0)) return null;
  const pad = box.height * 0.6;
  const left = clamp(Math.floor(box.x - pad), size.width);
  const top = clamp(Math.floor(box.y - pad), size.height);
  const right = clamp(Math.ceil(box.x + box.width + pad), size.width);
  const bottom = clamp(Math.ceil(box.y + box.height + pad), size.height);
  if (right - left < 4 || bottom - top < 4) return null;
  return { originX: left, originY: top, width: right - left, height: bottom - top };
}
