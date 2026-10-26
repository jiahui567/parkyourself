// Loads every screen file so a broken import or syntax error fails in CI
// instead of on the phone. Screens are not rendered here; check them on the
// phone. This file lives outside src/app because every file there is a route.
const ROUTES = [
  '_layout',
  '(tabs)/_layout',
  '(tabs)/index',
  '(tabs)/history',
  '(tabs)/spending',
  '(tabs)/settings',
  'park',
  'session/[id]',
  'session/end/[id]',
  'sessions',
  'places/index',
  'places/[id]',
  'car-parks/[id]',
  'holidays',
  'vehicles/index',
  'vehicles/new',
  'vehicles/[id]',
  'debug',
  'account',
  'report/[id]',
];

describe('routes', () => {
  it.each(ROUTES)('src/app/%s exports a screen component', (route) => {
    const screen = require(`../src/app/${route}`);

    expect(typeof screen.default).toBe('function');
  });
});
