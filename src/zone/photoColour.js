import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { getColors } from 'react-native-image-colors';

import { deletePhotoFiles } from '../db';
import { hexToColourName, isChromatic, signCropRect } from './zoneColour';

const HEX = /^#[0-9A-F]{6}$/i;

async function imageSize(uri) {
  const context = ImageManipulator.manipulate(uri);
  try {
    const image = await context.renderAsync();
    const size = { width: image.width, height: image.height };
    image.release();
    return size;
  } finally {
    context.release();
  }
}

// The only code that calls react-native-image-colors, which reads colours on
// the phone (Android's Palette). Returns the main colour of the sign's panel
// around box (the likeliest code's OCR box, in the photo's pixels) as
// { name, hex }, name null when it is too plain to suggest (isChromatic), or
// null when the photo has nothing there to read.
export async function sampleSignColour(uri, box) {
  const rect = signCropRect(box, await imageSize(uri));
  if (!rect) return null;
  const context = ImageManipulator.manipulate(uri).crop(rect);
  let cropUri;
  try {
    const image = await context.renderAsync();
    try {
      cropUri = (await image.saveAsync({ format: SaveFormat.PNG })).uri;
    } finally {
      image.release();
    }
  } finally {
    context.release();
  }
  try {
    // Android refuses an empty fallback. Black comes back only when Palette
    // finds no colour at all, and is never suggested (isChromatic).
    const colours = await getColors(cropUri, { fallback: '#000000', pixelSpacing: 1 });
    const hex = colours.platform === 'ios' ? colours.background : colours.dominant;
    if (!HEX.test(hex ?? '')) return null;
    const name = hexToColourName(hex);
    return { name: isChromatic(name) ? name : null, hex: hex.toUpperCase() };
  } finally {
    // The crop was only for reading; the photo itself is untouched.
    deletePhotoFiles([cropUri]);
  }
}
