// Loads every screen file so a broken import or syntax error fails in CI
// instead of on the phone. Screens are not rendered here; check them on the
// phone. This file lives outside src/app because every file there is a route.
const ROUTES = [
  '_layout',
  'index',
  'park',
  'session/[id]',
  'history',
  'vehicles/index',
  'vehicles/new',
  'debug',
];

describe('routes', () => {
  it.each(ROUTES)('src/app/%s exports a screen component', (route) => {
    const screen = require(`../src/app/${route}`);

    expect(typeof screen.default).toBe('function');
  });
});
