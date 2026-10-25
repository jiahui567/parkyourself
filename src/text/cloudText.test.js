import { cloudErrorText } from './cloudText';

describe('cloudErrorText', () => {
  it.each([
    { from: 'no connection (database or storage)', error: new TypeError('Network request failed'), text: /^Could not reach the server/ },
    { from: 'no connection (sign-in)', error: { name: 'AuthRetryableFetchError', message: '{}' }, text: /^Could not reach the server/ },
    { from: 'a second pending report', error: { code: '23505', message: 'duplicate key value' }, text: 'You already have a report waiting for this car park.' },
    { from: 'a check the phone does not repeat', error: { code: '23514', message: 'violates check constraint' }, text: /^The server refused this report/ },
    { from: 'the daily report limit', error: { code: 'P0001', message: 'You can send at most 5 reports a day. Try again tomorrow.' }, text: 'You can send at most 5 reports a day. Try again tomorrow.' },
    { from: 'a wrong code', error: { name: 'AuthApiError', code: 'otp_expired', status: 403, message: 'Token has expired or is invalid' }, text: 'That code is wrong or has expired. Ask for a new one.' },
    { from: 'too many codes', error: { code: 'over_email_send_rate_limit', status: 429, message: 'email rate limit exceeded' }, text: /^Too many codes/ },
    { from: 'anything else', error: { code: 'XX000', message: 'Something odd' }, text: 'Something odd' },
    { from: 'an error with no message', error: {}, text: 'Something went wrong. Try again.' },
  ])('explains $from', ({ error, text }) => {
    expect(cloudErrorText(error)).toMatch(text);
  });
});
