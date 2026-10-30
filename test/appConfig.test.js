// Native settings in app.json that the user decided (2026-10-30) and that no
// other test would miss: Android's backup and phone-to-phone transfer stay
// off, and permissions the app never uses stay out of the manifest.
import { readFileSync } from 'node:fs';
import path from 'node:path';

const { expo } = JSON.parse(readFileSync(path.join(__dirname, '../app.json'), 'utf8'));

it("keeps Android's backup off, and its phone-to-phone transfer through the plugin", () => {
  expect(expo.android.allowBackup).toBe(false);
  expect(expo.plugins).toContain('./plugins/withNoDeviceTransfer');
});

it('keeps the permissions the app never uses blocked', () => {
  expect(expo.android.blockedPermissions).toEqual(
    expect.arrayContaining([
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.WRITE_EXTERNAL_STORAGE',
    ])
  );
});
