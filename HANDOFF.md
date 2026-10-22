# Handoff: changes made on 2026-10-22

For the AI agent on the build laptop. That laptop is already set up and has built this app before. This note says what changed in a session on another laptop and what to watch for. Delete it once the user has checked everything on the phone.

None of it has been run on a phone. Lint and Jest pass: 39 suites, 563 tests.

## What changed

| Area | Change |
|---|---|
| Native config | `app.json` adds the `expo-camera` (with `recordAudioAndroid: false`), `expo-notifications` and `expo-mlkit-ocr` plugins |
| Dependency | New: `expo-mlkit-ocr`, pinned to exactly `0.2.7` (OCR) |
| Photos (M1) | Several per session on Park; Add photo, full-screen view, share and delete on Find |
| Car rename (M1) | New screen `src/app/vehicles/[id].js`, opened from the pencil button in Cars |
| OCR (M4) | The first photo is read on the phone; level and bay chips fill the fields. Colour suggestion is not built |
| Notifications (M3) | Ongoing notification per parked car, reminders, lead time in Settings. Code in `src/notify/` |
| Share (M5) | Share the parking info from Find, or a photo from the photo view. No QR code |
| Data layer | No schema change and no new migration. `sessions.start` takes `photo_files: [{ file_uri, ocr_text }]`. New: `sessions.extend`, `vehicles.rename`, `preparePhoto`, `savingPhotos`, `sharePhoto` |
| Lint | ESLint now enforces import order and a 120-character limit for code lines (`npx eslint --fix` sorts imports) |
| Tests | `test/setup.js` stubs `expo-mlkit-ocr`, because it loads a native module on import |
| Docs | PLAN.md, README.md, AGENTS.md and the skills are updated. AGENTS.md records one accepted privacy exception: Google ML Kit sends Google anonymous usage metrics |

## Steps

1. **Before pulling,** run `git status`. If this laptop has uncommitted work of its own, stop and ask the user before pulling.
2. Pull, then run `npm ci` (`package-lock.json` changed).
3. Run `npx expo-doctor`, `npm run lint` and `npm test`. All must pass. The database tests need Node 22.13 or later.
4. Rebuild the native app: `npx expo run:android`. A JavaScript reload is not enough, because of the new plugins and the new native module.
5. In the app, open Settings → Developer → Database check. Every row must say PASS, including the two new photo checks and "Delete the test database".

## Watch out for

- **The OCR module may not build.** `expo-mlkit-ocr` is a small, single-maintainer module built against Expo 55 and React Native 0.82, and this project is on SDK 58 and RN 0.88. If the Android build fails because of it, stop and report the error. Do not edit `android/` by hand; it is generated.
- **Stale native code.** If the build behaves oddly after the plugin changes, regenerate with `npx expo prebuild --clean` and build again. `android/` is not in git, so this is safe.
- **The phone's data.** There is no schema change, so an update keeps the data. Even so, ask the user to export the database first (Settings → Export database). If Android refuses the update, never uninstall the app without the user's OK: uninstalling deletes their parking data.
- **Permissions.** The camera permission is asked the first time you take a photo. The notification permission is asked when Find first opens after parking, at most once per run of the app. Settings has an Allow notifications button if it was refused.
- **Notification icon.** No icon is set yet, so it may show as a white square. That is M8 work, not a bug to fix now.

## Check on the phone, in dark and light mode

- **Park:**
  - Take the first photo, and check that level and bay chips appear.
  - Add a second photo, open it full screen and remove it.
  - Save, and check the photos are on Find.
- **Find:**
  - Add photo; share and delete a photo.
  - Share the parking info into WhatsApp.
  - Extend timer.
- **Notifications:**
  - The ongoing notification appears after parking.
  - With a 30-minute timer, a 5-minute lead time and the screen locked, the reminder fires.
  - Extend timer on the notification updates Find and the notification.
  - Found my car clears the notification.
- **Cars:** rename a parked car, and check its notification shows the new name.
- **Earlier work, not yet checked on the phone:** Spending and Settings.

Record what works or fails. Ticks in PLAN.md "Milestones" only go in after the user confirms.
