// Fee and date rules follow the phone's local calendar. Pinning the time zone
// gives the same results on every laptop and in CI (which runs in UTC).
// Malaysia has no daylight saving, so every test day is 24 hours long.
process.env.TZ = 'Asia/Kuala_Lumpur';

module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/test/setup.js'],
  // Reanimated and its worklets have no native side in Jest; this resolves
  // their web versions instead.
  resolver: 'react-native-reanimated/jest/resolver',
  // npm installs some Expo packages (such as expo-asset, used by expo-sqlite)
  // inside node_modules/expo. The app's bundler finds them there; Jest needs
  // to be told.
  modulePaths: ['<rootDir>/node_modules/expo/node_modules'],
};
