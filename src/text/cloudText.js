// Errors from the version 2 server (sign-in, rate reports) as sentences for
// the user. error is what @supabase/supabase-js gave back: a database error
// ({ code, message }), an Auth error ({ name, code, status, message }) or a
// Storage error ({ status, message }).

const OFFLINE = 'Could not reach the server. Check your connection and try again.';

// A call the sync gave up on (src/lib/timeout.js): the signal is too weak.
export const TIMED_OUT_TEXT = 'The server took too long to answer. It is tried again later.';
// Sign out given up on: the server was not told, so the user is still signed in.
export const SIGN_OUT_TIMED_OUT_TEXT = 'Signing out took too long, so you are still signed in. Try again with a better signal.';

const BY_CODE = {
  // A unique index: one report waits per user and car park.
  23505: 'You already have a report waiting for this car park.',
  // A check the phone does not repeat, such as a name over 100 characters.
  23514: 'The server refused this report. Check the name and the rates.',
  otp_expired: 'That code is wrong or has expired. Ask for a new one.',
  over_email_send_rate_limit: 'Too many codes were asked for. Wait a while, then try again.',
  email_address_invalid: 'Check the email address.',
  // Supabase's own email sender, before the project has its own (PLAN.md, C2).
  email_address_not_authorized: 'This server can only send codes to its team for now.',
};

export function cloudErrorText(error) {
  const message = typeof error === 'string' ? error : String(error?.message ?? '');
  if (error?.name === 'AuthRetryableFetchError' || /network request failed|failed to fetch|fetch failed/i.test(message)) {
    return OFFLINE;
  }
  if (BY_CODE[error?.code]) return BY_CODE[error.code];
  // The server's own sentence, from a check written for users (the daily limit).
  if (error?.code === 'P0001') return message;
  return message || 'Something went wrong. Try again.';
}
