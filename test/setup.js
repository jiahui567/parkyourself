// Native modules do not exist in Jest. src/db only needs randomUUID from
// expo-crypto, and Node provides the same function.
jest.mock('expo-crypto', () => ({ randomUUID: require('node:crypto').randomUUID }));

// expo-mlkit-ocr looks up its native module as soon as it is imported, which
// would stop the Park screen from loading in test/routes.test.js. Nothing in
// Jest reads a photo; src/ocr/pillarText.js is where the OCR rules are tested.
jest.mock('expo-mlkit-ocr', () => ({ recognizeText: async () => ({ text: '', blocks: [] }) }));
