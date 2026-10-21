// Builds every native module with CMake 3.31.6 instead of the Android Gradle
// Plugin's default 3.22.1. The Ninja bundled with 3.31.6 (1.12) supports
// Windows long paths; the older one fails with "ninja: error: mkdir(...)" when
// the project sits in a long folder path such as "Desktop\Park Yourself".
//
// It writes cmake.dir into android/local.properties, which the Android Gradle
// Plugin reads for all modules. (Setting cmake.version per module from Gradle
// fails: some modules are already configured by then.)
//
// Needs on the build machine: Android SDK Manager → SDK Tools → CMake 3.31.6,
// and on Windows, long paths enabled (registry LongPathsEnabled = 1). If that
// CMake is missing, the build falls back to the default one.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { withDangerousMod } = require('expo/config-plugins');

const CMAKE_VERSION = '3.31.6';

function androidSdkDir() {
  const fromEnv = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  if (fromEnv) return fromEnv;
  if (process.platform === 'win32') return path.join(process.env.LOCALAPPDATA ?? '', 'Android', 'Sdk');
  if (process.platform === 'darwin') return path.join(os.homedir(), 'Library', 'Android', 'sdk');
  return path.join(os.homedir(), 'Android', 'Sdk');
}

module.exports = function withCmakeVersion(config) {
  return withDangerousMod(config, [
    'android',
    (cfg) => {
      const cmakeDir = path.join(androidSdkDir(), 'cmake', CMAKE_VERSION);
      if (!fs.existsSync(path.join(cmakeDir, 'bin'))) {
        console.warn(
          `withCmakeVersion: CMake ${CMAKE_VERSION} not found at ${cmakeDir}. ` +
            'Install it from Android Studio SDK Manager → SDK Tools, or long paths may fail to build.'
        );
        return cfg;
      }
      const file = path.join(cfg.modRequest.platformProjectRoot, 'local.properties');
      const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
      const kept = existing.split(/\r?\n/).filter((line) => line && !line.startsWith('cmake.dir='));
      // Forward slashes avoid .properties backslash escaping.
      kept.push(`cmake.dir=${cmakeDir.replace(/\\/g, '/')}`);
      fs.writeFileSync(file, kept.join('\n') + '\n');
      return cfg;
    },
  ]);
};
