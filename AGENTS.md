Park Yourself is an Expo / React Native app (Android first) that remembers where you parked and what it costs. All data stays on the phone. Read README.md for setup and PLAN.md for every feature and decision.

## Project facts

- JavaScript only. Never create `.ts` or `.tsx` files, add TypeScript, or run `tsc`.
- Expo SDK 58 (React Native 0.88, React 19.3).
- Android first. Keep code cross-platform, but only Android is built and tested.
- npm is the package manager (`package-lock.json`).
- PLAN.md is the source of truth for features and decisions. Read the relevant section before starting a milestone. If a request contradicts PLAN.md, ask first, then update PLAN.md in the same change.

## Expo has changed: do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo or React Native API:

1. Fetch the SDK 58 docs: `https://docs.expo.dev/versions/v58.0.0/`
2. For anything else, fetch https://docs.expo.dev/llms.txt, an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the page you need; never answer from memory.

## Commands

```bash
npx expo install <package>  # always use instead of npm install: resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo run:android        # build and install the development build on the phone
npm run release             # build and install the release build (runs without the laptop)
npm run lint                # lint src/ and test/ (add -- --no-cache if a result looks stale)
npm test                    # Jest tests (time zone pinned to Asia/Kuala_Lumpur in jest.config.js)
npm test -- --coverage      # also writes a coverage report to coverage/ (git-ignored)
npm run db:pull             # copy the phone's database into db-snapshot/
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
npx supabase start          # version 2: start local Supabase (Docker Desktop must be running); stop with npx supabase stop
npx supabase db reset       # rebuild the local Supabase database from supabase/migrations/
npx supabase test db        # pgTAP tests in supabase/tests/ against local Supabase
npx supabase db push --linked  # push new migrations to hosted dev (run with --dry-run first)
npm run carparks:sql        # write a Supabase migration from src/carparks/carParkList.json (after every list change)
```

- Version 2 server: SQL in `supabase/` follows PLAN.md, "Version 2" (environments, migration checklist, explicit `GRANT`s). Never change a hosted Supabase schema in its dashboard. The app picks its server from `.env.development.local` in development builds and `.env.production.local` in release builds (copy `.env.example`); never put a secret key or the database password in an env file.

## Navigation

- Expo Router for all navigation. Routes live in `src/app/`: every file there is a screen, and `_layout.js` files define navigators.
- Main sections are bottom tabs in `src/app/(tabs)/` (Home, History, Spending, Settings), listed in `(tabs)/_layout.js`. Detail screens (Park, Find, Found my car, Sessions, Places, Car park, Public holidays, Cars, Add a car, Rename car, Account, Report rates) live outside `(tabs)` and open above the tab bar from the root stack.
- Keep non-route code outside `src/app/`, and never put tests or helpers there (every file in it becomes a route): shared components in `src/components/`, hooks in `src/hooks/`, data access in `src/db/`, display text in `src/text/`, zone colours in `src/zone/` (`zoneColour.js` holds the tested rules; `photoColour.js` is the only code that calls `react-native-image-colors`), OCR in `src/ocr/` (`pillarText.js` reads the sign (level, bay, a colour word) and is tested; `readText.js` is the only code that calls `expo-mlkit-ocr`), timer rules in `src/timer/`, spending totals in `src/spending/`, notifications in `src/notify/` (`plan.js` decides what to show and is tested; `notifications.js` is the only code that calls `expo-notifications`), location in `src/location/` (`readLocation.js` is the only code that calls `expo-location`; its rules are in `src/lib/geo.js`, tested), the version 2 server in `src/cloud/` (`supabase.js` is the only code that calls `@supabase/supabase-js`: the signed-out download, sign-in, and rate reports; its errors become sentences in `src/text/cloudText.js`), the car park list in `src/carparks/` (`carParkList.json` is the one source of the data, researched from the web: give every entry a `source_url` and `checked_on`, add a rate change as new rows with a later `effective_from` instead of editing old ones, bump `version`, then run `npm run carparks:sql` for the server; the app downloads it daily through `src/cloud/carParkUpdates.js`; `reports.js` holds the rate report rules, the same as the server's), and small pure helpers that belong to no single feature (money, time, place names) in `src/lib/`. Only `src/db/` and `src/fees/` have an `index.js`; import other modules by file.
- Screens stay thin: rules and text live in the tested modules above; a screen only loads, shows and saves. Load data with `useFocusedLoad` so it refreshes when the user comes back to the screen. The one exception is the Database check screen's self-test (`debug.js`): it builds a throwaway database, so it runs with `useEffect` once when the screen opens and again only when asked.
- Import `Link`, `router` and `useLocalSearchParams` from `expo-router`.

## Data

- Only `src/db/` runs SQL. Screens import functions from `src/db/index.js`. Components take their data as props; the two exceptions, `AppThemeProvider` (the theme setting) and `PlacePicker` (live place search), also call `src/db/index.js`.
- Synced tables (`vehicle`, `place`, `place_rate`, `public_holiday`, `parking_session`): ids come from `newId()`, writes go through the helpers in `src/db/core.js`, rows are soft-deleted (`deleted_at`) and never `DELETE`d, and every read skips deleted rows. The one exception is display only: a session keeps showing its place's name after the place is deleted.
- `photo`, `setting`, `car_park`, `car_park_rate` and `car_park_report` are local-only and never sync. The car park tables are a copy of reference data, replaced whole by `carParks.refresh` from a download (which always wins) or the built-in copy; `car_park_report` (rate reports waiting for review) is replaced whole by `carParks.replaceReports` after each download.
- A schema change is a new step at the end of `MIGRATIONS` in `src/db/migrations.js`. Never edit a step that has already run on a phone. Add a `src/db/selfTest.js` check for every new data rule.
- Multi-step writes use `inTransaction(db, async (txn) => ...)`, and every query inside uses `txn`, not `db`.
- Always bind values with `?`. Never build SQL text from user input.
- Test data functions in Jest with `openMigratedTestDatabase()` from `test/testDatabase.js` (Node's built-in SQLite). `src/db/selfTest.js` stays for behaviour only the phone's driver shows.
- Money is integer sen (RM 3.00 = `300`). Never use floats for money.
- Times are stored as UTC epoch milliseconds. Convert to local time only for display and for deciding weekday, weekend or public holiday.

## Fees

- Fee logic lives in pure functions in `src/fees/`, with no database or React code. Screens get a session's fee with `sessionFee` (which reads `rate_snapshot` and calls `calcStayFee`; Home and Find use `feeSoFar`, its live version) and the day type with `dayTypeOf`, from `src/fees/index.js`; they never compute fees themselves. `sessions.end` stores the fee itself, so the fee saved matches the fee shown.
- Rates passed to the fee functions are `place_rate` rows (snake_case columns), the same shape stored in `rate_snapshot`.
- Every row of the fee test table in PLAN.md is a Jest test in `src/fees/calcFee.test.js`. Change the table and the tests together.
- Tests build times in local phone time; a test about local versus UTC dates uses an explicit UTC instant (`Date.parse('...Z')`).

## Privacy (local-first)

- No network calls except ones the user starts: Share and Open in Google Maps. One exception, chosen by the user on 2026-10-23: once the location is allowed, Park looks up a new place's name with Android's geocoder (`lookUpPlaceName` in `src/location/readLocation.js`), which sends the location to Google. A second exception, chosen by the user on 2026-10-24: at most once a day, when the app opens, it downloads the public car park list from Supabase (`downloadCarParkList` in `src/cloud/supabase.js`); it sends no personal data, only the request itself (Supabase sees the phone's IP address), and always signed out; since C10 it also downloads the rate reports waiting for review (`downloadPendingReports`). Add no other. Sign-in and rate reports (C2, C10, chosen by the user on 2026-10-25) call the server only when the user starts it: Send code, Sign in, Sign out, Delete account, Send report, and opening Account or Report rates while signed in (which may renew the session and loads the user's reports). The session is never refreshed in the background (`autoRefreshToken: false`).
- No analytics, ads or crash-reporting SDKs without asking. One exception, accepted by the user on 2026-10-22: Google ML Kit (`expo-mlkit-ocr`, used for OCR) sends Google per-installation identifiers and diagnostics and usage metrics over HTTPS, with no opt-out (Google's ML Kit data disclosure). Do not add another library that does this without asking.
- Photos never leave the phone unless the user shares one (`sharePhoto`, from the photo view) or attaches a rate board photo to a rate report and taps Send report (`sendReport`, to a private bucket only the developer sees; chosen by the user on 2026-10-25). Session photos are never uploaded.
- Never commit `db-snapshot/` or any real parking data.

## Native code and dependencies

- `android/` and `ios/` are generated (Continuous Native Generation). Never create or edit them by hand; configure native behaviour in `app.json` or a config plugin in `plugins/`.
- Keep `plugins/withCmakeVersion.js`: Windows builds need it for long paths.
- Keep `plugins/withImageColorsJvmTarget.js` until `react-native-image-colors` sets its own JVM target: without it the Android build stops with "Inconsistent JVM-target compatibility" (Java 17, Kotlin 21).
- Expo Go is not supported. After adding a library with native code or changing `app.json` plugins, say that `npx expo run:android` is needed.
- Ask before adding a dependency, and say why it is needed. Prefer Expo modules over third-party libraries.

## Code style

- Function components and hooks. Styles with `StyleSheet`. No UI library without asking.
- The app has a dark theme (default) and a light theme. Build styles from the active theme with a module-level `createStyles = (c) => StyleSheet.create(...)` and `useThemedStyles(createStyles)`; take colours only from the tokens in `src/components/theme.js`, never a hex in a screen; give every `Text` a colour. A file whose styles use no colour may use a plain module-level `StyleSheet.create`. The design standard is in the `add-screen` skill.
- Imports: packages, a blank line, then relative imports with `../` before `./`, each sorted ignoring case. Code lines are at most 120 characters; ESLint does not check a line that holds a string, template literal, URL or regex, so SQL, test tables and SVG paths stay on one line. ESLint enforces both (`import/order`, `max-len`); the project has no formatter config.
- One screen per file in `src/app/`.
- Format money with `formatRM`, prefill an amount field with `formatAmountInput`, read typed amounts with `parseRM` (`src/lib/money.js`), and dates and durations with `src/lib/time.js`; never format inline.
- No empty `catch` blocks: show the user an error or rethrow. The one exception is best-effort file cleanup after the data is saved, or of a temporary file such as the colour crop in `src/zone/photoColour.js` (`deletePhotoFiles` in `src/db/photos.js`), which logs with `console.warn` and says why in a comment.
- Comments explain why, not what.
- UI text is English.

## Finishing a task

- Run `npm run lint` and `npm test`. If the database changed, the self-test must pass on the phone. Say clearly what was not run on a device.
- Add every new screen to the `ROUTES` list in `test/routes.test.js`.
- Stay inside the task: no unrelated refactors or renames.
- Ask the `reviewer` subagent to review the change, and fix what it finds, before saying the work is done.
- Update README.md when setup or commands change. Tick a milestone in PLAN.md only after the user confirms it works on the phone.
- Never commit, push or force-push unless asked.
- When PLAN.md does not answer a question, ask instead of guessing.

## Skills, subagents and hooks

- Skills in `.claude/skills/`, loaded before that kind of work: `add-screen` (steps and the design standard), `add-migration`, `next-milestone`, `capture-lesson`.
- Subagents in `.claude/agents/`: `reviewer` (read-only review of uncommitted changes) and `test-writer` (writes and runs Jest tests).
- Hooks in `.claude/settings.json`: edits to `android/`, `ios/`, `db-snapshot/` and `node_modules/` are blocked; a reminder appears when the user's message looks like a correction; lint and tests run before Claude finishes if code changed since the last passing check.

## Corrections become lessons

When the user corrects your work or states a lasting rule for this project, run the `capture-lesson` skill before continuing. It writes the rule into the matching skill or subagent, or into Lessons below, so later sessions do not repeat the mistake.

## Lessons

Added by `capture-lesson`, newest last: one or two lines each, the rule then the reason, with the date.

(none yet)
