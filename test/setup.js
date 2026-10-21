// Native modules do not exist in Jest. src/db only needs randomUUID from
// expo-crypto, and Node provides the same function.
jest.mock('expo-crypto', () => ({ randomUUID: require('node:crypto').randomUUID }));
