/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  testEnvironment: 'node',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|firebase)',
  ],
  moduleNameMapper: {
    // Silence NativeWind / CSS imports in tests
    '\\.css$': '<rootDir>/__mocks__/fileMock.js',
  },
  setupFilesAfterFramework: [],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
};
