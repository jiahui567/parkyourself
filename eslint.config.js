// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    // The project has no formatter, so lint keeps imports and line length in
    // the style the code already uses.
    rules: {
      // Packages, a blank line, then relative imports: ../ before ./, each
      // sorted ignoring case. The path group keeps ./ imports in the same
      // block as ../ ones, with no blank line between them.
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'parent', 'index'],
          pathGroups: [{ pattern: './**', group: 'parent', position: 'after' }],
          distinctGroup: false,
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      // ESLint skips any line holding a string, template literal, URL or regex,
      // so SQL, test tables and SVG paths stay on one line; code lines are checked.
      'max-len': [
        'error',
        { code: 120, ignoreStrings: true, ignoreTemplateLiterals: true, ignoreUrls: true, ignoreRegExpLiterals: true },
      ],
    },
  },
  {
    // Jest provides these in test files without an import.
    files: ['**/*.test.js', 'test/**/*.js'],
    languageOptions: {
      globals: {
        __dirname: 'readonly',
        afterAll: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        beforeEach: 'readonly',
        describe: 'readonly',
        expect: 'readonly',
        it: 'readonly',
        jest: 'readonly',
        test: 'readonly',
      },
    },
    settings: {
      // Node before 22.13, and 23.0 to 23.3, keep node:sqlite behind
      // --experimental-sqlite, so on those versions the import plugin cannot
      // tell it is built in.
      'import/core-modules': ['node:sqlite'],
    },
  },
]);
