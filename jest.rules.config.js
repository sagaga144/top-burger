/** Firestore rules tests. Run with `npm run test:rules` (starts the emulator). */
const base = require('./jest.config');

/** @type {import('jest').Config} */
module.exports = {
  ...base,
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  testMatch: ['<rootDir>/rules-tests/**/*.test.ts'],
  testTimeout: 30000,
};
