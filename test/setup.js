// Native modules do not exist in Jest. src/db only needs randomUUID from
// expo-crypto, and Node provides the same function.
jest.mock('expo-crypto', () => ({ randomUUID: require('node:crypto').randomUUID }));

// expo-mlkit-ocr looks up its native module as soon as it is imported, which
// would stop the Park screen from loading in test/routes.test.js. Nothing in
// Jest reads a photo; src/ocr/pillarText.js is where the OCR rules are tested.
jest.mock('expo-mlkit-ocr', () => ({ recognizeText: async () => ({ text: '', blocks: [] }) }));

// react-native-image-colors is native too; src/zone/zoneColour.js holds the
// colour rules that are tested.
// Like the Android module, it refuses a fallback that is not a hex colour.
jest.mock('react-native-image-colors', () => ({
  getColors: async (uri, { fallback = '#000000' } = {}) => {
    if (!/^#([0-9A-F]{6}|[0-9A-F]{3})$/i.test(fallback)) throw new Error('Invalid fallback hex color');
    return { platform: 'android', dominant: fallback };
  },
}));
