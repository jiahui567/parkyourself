// Builds react-native-image-colors' Kotlin for Java 17, the target its Java
// code already gets. Its android/build.gradle sets a JVM target only for the
// Android Gradle Plugin before 8, so with AGP 9 the Kotlin compiler takes the
// JDK's own (21) and Gradle stops the build with "Inconsistent JVM-target
// compatibility detected for tasks 'compileDebugJavaWithJavac' (17) and
// 'compileDebugKotlin' (21)". The other Expo modules get 17 for both from
// Expo's Gradle plugin, which this library does not use.
//
// It adds a block to android/build.gradle that sets the target on that one
// project's Kotlin tasks. Remove this plugin once the library sets a target
// itself (check node_modules/react-native-image-colors/android/build.gradle).
const { withProjectBuildGradle } = require('expo/config-plugins');

const MARKER = '// withImageColorsJvmTarget';

const BLOCK = `
${MARKER}: react-native-image-colors sets no JVM target for AGP 8+ (see plugins/).
subprojects { sub ->
  if (sub.name == 'react-native-image-colors') {
    sub.tasks.withType(org.jetbrains.kotlin.gradle.tasks.KotlinCompile).configureEach {
      compilerOptions.jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
    }
  }
}
`;

module.exports = function withImageColorsJvmTarget(config) {
  return withProjectBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') {
      throw new Error('withImageColorsJvmTarget: android/build.gradle is not Groovy; update the plugin.');
    }
    if (!cfg.modResults.contents.includes(MARKER)) cfg.modResults.contents += BLOCK;
    return cfg;
  });
};
