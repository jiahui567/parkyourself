// Fee and date rules follow the phone's local calendar. Pinning the time zone
// gives the same results on every laptop and in CI (which runs in UTC).
// Malaysia has no daylight saving, so every test day is 24 hours long.
process.env.TZ = 'Asia/Kuala_Lumpur';

module.exports = {
  preset: 'jest-expo',
};
