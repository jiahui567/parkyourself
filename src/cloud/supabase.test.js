import { ACCOUNT_CHANGED_TEXT } from '../text/cloudText';

// The sync's calls (requireAccount): each goes to the account its run started
// with, sent with that account's own token, so a run still going after Sign
// out never reaches the next account to sign in. @supabase/supabase-js is
// replaced by a client whose session the tests set.
const mockSession = { current: null };
const mockCalls = [];

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { getSession: async () => ({ data: { session: mockSession.current }, error: null }) },
    rpc: (fn, args) => {
      const call = { fn, args, headers: {} };
      mockCalls.push(call);
      const builder = {
        setHeader(name, value) {
          call.headers[name] = value;
          return builder;
        },
        then: (resolve) => resolve({ data: [], error: null }),
      };
      return builder;
    },
  }),
  isAuthApiError: () => false,
}));

const sessionOf = (id) => ({ access_token: `token-${id}`, user: { id, email: `${id}@example.test` } });

let supabase;
beforeAll(() => {
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';
  jest.isolateModules(() => {
    supabase = require('./supabase');
  });
});
afterAll(() => {
  delete process.env.EXPO_PUBLIC_SUPABASE_URL;
  delete process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
});
beforeEach(() => {
  mockCalls.splice(0);
});

it('sends a push and a pull with the token of the account the run started with', async () => {
  mockSession.current = sessionOf('user-a');

  await supabase.pushSyncedRows('vehicle', [], 'user-a');
  await supabase.pullSyncedRows('vehicle', { afterUs: null, afterId: null, limit: 200 }, 'user-a');

  expect(mockCalls.map(({ fn, headers }) => [fn, headers.Authorization])).toEqual([
    ['push_synced_rows', 'Bearer token-user-a'],
    ['pull_synced_rows', 'Bearer token-user-a'],
  ]);
});

it('makes no call once another account has signed in', async () => {
  mockSession.current = sessionOf('user-b');

  await expect(supabase.pushSyncedRows('vehicle', [], 'user-a')).rejects.toMatchObject({
    message: ACCOUNT_CHANGED_TEXT,
    accountChanged: true,
  });
  await expect(
    supabase.pullSyncedRows('vehicle', { afterUs: null, afterId: null, limit: 200 }, 'user-a')
  ).rejects.toMatchObject({ accountChanged: true });
  expect(mockCalls).toEqual([]);
});

it('makes no call once signed out', async () => {
  mockSession.current = null;

  await expect(supabase.pushSyncedRows('vehicle', [], 'user-a')).rejects.toThrow('Sign in with your email first.');
  expect(mockCalls).toEqual([]);
});
