# Park Yourself

An Android app that remembers where you parked and what it will cost.

Take a photo of the pillar sign and the app reads the level, bay number and zone colour. Add the first shop you saw after the lift or escalator, and the app shows you the way back. It remembers each car park's weekday, weekend and public holiday rates, calculates the fee while you are away, reminds you before paid parking runs out, lets you share your spot through WhatsApp, and shows your monthly parking spend.

All your parking data stays on the phone. An account is optional and only used to send rate reports for the public car park list; an optional cloud sync is planned for version 2. Three things reach the internet without a tap: Google ML Kit, which reads the pillar sign, sends Google anonymous usage metrics (see "Tech stack", OCR); only if you allow the location, Park asks Android's geocoder (Google) for the name of a new place; and at most once a day the app downloads the public car park list and the rate reports waiting for review from Supabase, signed out and sending no personal data (Supabase sees the phone's IP address). A rate report, and its photo of the rate board, is sent only when you tap Send report.

## Status

| | |
|---|---|
| Done (checked on the phone, 2026-10-23) | **M0 Setup**, **M1 Cars, park and find** (with pillar photos, car rename and the folded Park form), **M2 Places, rates and fees**, **M3 Notifications**, **M4 OCR and zone colour** (the sign read by text size with plates and ads left out, level, bay and zone colour filled in; tap-to-pick dropped), **M5 Share**, **M6 Monthly spending** and **M7 Location** |
| Done (checked on the phone with a release build, 2026-10-25) | **M8 Polish** (animations, loading animation, dark system dialogs, app icon, launch screen), **M9 Camera-first Park**, **M10 Timer wheel**, **M11 Car park list** and **M12 Car park list on Supabase**; version 2's **C0 Environments** |
| In progress | Version 2, built on local, not pushed to hosted dev yet: **C1** (the five synced tables with Row Level Security and pgTAP tests), **C2** (sign-in with an email code, Sign out, Delete account) and **C10** (rate reports for the car park list, with a rate board photo, moderated by the developer) |
| Next | Check C2 and C10 on the phone against local; push C1, C2 and C10 to hosted dev; then C3 (push), after the sync merge rules are confirmed |
| Plan | [PLAN.md](PLAN.md) has every decision, the screens, the fee rules, the data model, milestones M0 to M12 and the version 2 cloud design |

The M0 status screen (database facts and the self-test) is now **Database check**, under Settings → Developer in development builds.

## Features (version 1)

- **Park:** tap Park and the camera opens: one photo of the pillar sign (or Skip photo), and the form is filled in for you: level and bay by on-device OCR, the zone colour from the photo, the place and its rate from your location. Save is pinned at the bottom; only the note is optional. The timer and the location are set once in Settings.
- **Find:** photo, level and bay on the zone colour, and the route back in reverse ("Find Starbucks → escalator → B2 → blue zone, pillar C14"). While parked, you add how you left and the first shop as you walk out.
- **Saved places and rates:** a place remembers its weekday and weekend rates and an optional fixed public holiday amount, and fills them in next time.
- **Car park list:** about 30 Klang Valley malls with their public rates, researched on the web (each with its source and the date it was checked), with the date each rate took effect. The app downloads the list from Supabase once a day, so rates can change without an app update; a copy is built in for the first open and offline. Nearby ones are suggested from your location, and search finds them too.
- **Rate reports (version 2):** signed in with your email (Settings → Car park list → Account), report a listed car park's new rates, or suggest a car park that is not listed, from a saved place, with an optional photo of the rate board. The developer checks each report before the list changes; until then, other users see the reported rate on Park as "Not verified yet".
- **Timer wheel:** set the timer like an alarm, in Settings for every park and on Find for this one.
- **Fee:** calculated live; stays past midnight are shown as an estimate; you can record the amount actually paid.
- **Notifications:** ongoing notification with Navigate and Extend timer, plus a reminder before the timer ends.
- **Share:** the parking info as a message, or one photo, through WhatsApp or any app.
- **Monthly spending:** totals by month, place and car.
- **Location (optional):** fills in the place when you park and gives walking directions back in Google Maps, for open-air and street parking too.
- **Several cars**, and everything except naming a new place from the location works offline.
- **Look:** clean and minimal, dark mode by default with a Light option in Settings, and a bottom tab bar for Home, History, Spending and Settings.

## Tech stack

| Area | Choice |
|---|---|
| Framework | Expo SDK 58, React Native 0.88, React 19.3 |
| Language | JavaScript (no TypeScript) |
| Navigation | Expo Router, screens in `src/app/` |
| Database | `expo-sqlite`, plain SQL, migrations tracked by `PRAGMA user_version`, WAL mode, foreign keys compiled on |
| IDs | `expo-crypto` (`randomUUID()`) |
| Camera and photos | `expo-camera`, `expo-image-manipulator`, `expo-file-system`, `expo-image-picker` (a photo from the gallery; native code, so run `npx expo run:android` again after pulling it in) |
| OCR | `expo-mlkit-ocr` 0.2.7 (pinned): Google ML Kit's bundled Latin text model, read on the phone with no model download. ML Kit sends Google per-installation identifiers and diagnostics and usage metrics, with no opt-out; accepted on 2026-10-22 (AGENTS.md, Privacy) |
| Sharing and export | React Native's `Share` for the parking info; `expo-sharing` for a photo and for Export database |
| Notifications | `expo-notifications` |
| Location (optional) | `expo-location`, foreground only; native config in `app.json`, so run `npx expo run:android` again after pulling it in |
| Drawing | `react-native-svg`, also for the icons and the Home car drawing (no icon library) |
| Charts | `react-native-gifted-charts` with `expo-linear-gradient` (its gradient peer dependency), for the Spending tab's 12-month bar chart. `expo-linear-gradient` has native code: after pulling it in, run `npx expo run:android` again |
| Animation | `react-native-reanimated` with `react-native-worklets` (native code: run `npx expo run:android` again after pulling it in). Shared pieces in `src/components/motion.js`; the loading animation in `src/components/ParkingIntro.js`. Skipped when the phone's Reduce motion is on |
| Theme | Own dark and light colour sets in `src/components/theme.js`; the choice is saved in the `setting` table. Design rules in the `add-screen` skill |
| Build | Expo development build (`expo-dev-client`), built locally with Android Studio's SDK. Expo Go is not supported |
| Lint | ESLint 9 with `eslint-config-expo` |
| Tests | Jest 30 with the `jest-expo` preset, time zone pinned to `Asia/Kuala_Lumpur` in `jest.config.js`. Data layer tests run `src/db` on Node's built-in SQLite (`test/testDatabase.js`) |
| Version 2 server (in progress) | Supabase: `supabase` CLI (dev dependency, run with `npx supabase`), local stack in Docker Desktop, hosted dev project; `@supabase/supabase-js` in the app. See "Version 2 server" |
| CI | GitHub Actions (`.github/workflows/ci.yml`) on every push and pull request to `master`: **Lint and test** (ESLint, Jest), and **Supabase migrations** (every migration applied to an empty Postgres with `supabase db start`, then the pgTAP tests; it also fails if an existing migration file was edited, renamed or deleted, or a new one is named before the newest existing one) |

`react-native-image-colors` (approved for M4) was added on 2026-10-23 for the zone colour. M5 needs no extra library; the QR code was dropped.

## Project structure

```
park-yourself/
├── src/
│   ├── app/                 Screens (Expo Router): every file is a screen
│   │   ├── _layout.js       Root layout: opens the database, loads the theme, root stack
│   │   ├── (tabs)/          The bottom tab bar (the folder name is not part of the URL)
│   │   │   ├── _layout.js   Tabs: Home, History, Spending, Settings
│   │   │   ├── index.js     Home: the car drawing, where it is parked, round Park/Find button
│   │   │   ├── history.js   Finished parking, newest first, by month with totals
│   │   │   ├── spending.js  Monthly spending: month switcher, totals, 12-month chart
│   │   │   └── settings.js  Dark/Light, Cars, Places, Public holidays, Account, Extend timer, Export,
│   │   │                    Database check
│   │   ├── park.js          Park: place and rate, photos, level, bay, zone colour, timer, note
│   │   ├── session/[id].js  Find: the spot, the way back (added here while parked), fee so far, Extend timer,
│   │   │                    Found my car / Delete
│   │   ├── session/end/[id].js  Found my car summary: fee, missing rate, Amount paid
│   │   ├── sessions.js      One month's sessions for a place or car (from Spending)
│   │   ├── places/          Places list and a place's rates (edit, delete)
│   │   ├── holidays.js      Public holiday dates
│   │   ├── vehicles/        Cars list (default, archive), Add a car, Rename car ([id].js)
│   │   ├── account.js       Account: sign in with an email code, your reports, Sign out, Delete account
│   │   ├── report/[id].js   Report a place's rates to the car park list
│   │   └── debug.js         Database check (development builds)
│   ├── components/          Theme (theme.js, ThemeProvider.js), Button, IconButton, ChipGroup,
│   │                        SegmentedControl, Field, ErrorText, icons, CarLogo, RateForm,
│   │                        SwitchRow, List (ListSection, ListRow), PlacePicker, SessionCard,
│   │                        EstimatePill, CameraCapture, PhotoStrip, PhotoViewer, BackdropButton,
│   │                        Disclosure (folded rows), WayBackCard (Find's way back while parked),
│   │                        motion (shared animations), ParkingIntro (the loading animation)
│   ├── hooks/               useFocusedLoad (reload on return), useNow (ticking time),
│   │                        useOnAppActive (app back in front), useNotificationResponses
│   │                        (notification taps, in the root layout)
│   ├── notify/              Notifications: plan.js (what to show, tested), notifications.js
│   │                        (expo-notifications: channels, buttons, sync with the parked cars)
│   ├── text/                Screen text: way back, notifications, share message, rates, timer,
│   │                        photos, Park and Find questions and hints, Spending lines
│   ├── zone/                Zone colour chips and hex-to-name rules
│   ├── ocr/                 pillarText.js (level and bay suggestions from the sign's text),
│   │                        readText.js (OCR on the phone with expo-mlkit-ocr)
│   ├── fees/                Fee rules: pure functions, no database or React
│   │   ├── calcFee.js       Fee per day and per stay (overnight estimate, borrowed rates)
│   │   ├── dayType.js       Weekday, weekend or public holiday
│   │   ├── sessionFee.js    A session's fee from its rate snapshot
│   │   ├── rateForm.js      Typed rate form to place_rate fields and back; which rates to save
│   │   └── parkRates.js, endForm.js, placeRatesForm.js, feeSoFar.js  Rules behind Park,
│   │                        Found my car, a place's rates and the fee so far
│   ├── timer/               Timer options, Extend, reminder times
│   ├── spending/            Monthly totals, by place and by car; Sessions screen filter
│   ├── carparks/            The car park list: carParkList.json (the one source), ratesInEffect.js
│   │                        (the rate in effect on a day), schedule.js (when to download again),
│   │                        reports.js (what a rate report may hold, as the server checks it)
│   ├── cloud/               Version 2: supabase.js (the only code that calls @supabase/supabase-js:
│   │                        the download, sign-in, rate reports), carParkUpdates.js (the daily download)
│   ├── lib/                 Shared helpers
│   │   ├── money.js         formatRM ("RM 3.00"), formatAmountInput ("3.00") and parseRM
│   │   ├── time.js          Local date and month keys, time/date/month/duration text
│   │   ├── placeName.js     Whether a typed place name is new
│   │   ├── motion.js        Easing, count-up and burst numbers for the animations
│   │   └── listIndex.js     Which photo to show after one is deleted
│   └── db/                  Data layer: the only code that runs SQL
│       ├── index.js         What screens import
│       ├── core.js          Insert, update, soft delete, transactions, UUIDs
│       ├── migrations.js    Schema steps, applied in order
│       ├── migrate.js       Applies migrations on app start
│       ├── selfTest.js      Checks the data layer rules (development builds)
│       ├── sessions.js      Park (place, rates, holiday, snapshot, photos in one transaction),
│       │                    Extend timer, end with fee
│       ├── photos.js        Photo rows (with OCR text), and the image files: shrink, keep, share, delete
│       ├── places.js, holidays.js  Saved places and rates, public holiday dates
│       ├── preferences.js   Extend and reminder minutes (setting table)
│       ├── export.js        Export database: WAL checkpoint, copy, share sheet
│       ├── carParks.js      The phone's copy of the car park list: refresh, search, rates in effect
│       └── vehicles.js, settings.js
├── test/                    Jest helpers: Node SQLite test database, setup, screen-load check
├── supabase/                Version 2 server: config.toml, migrations/ (PostgreSQL), tests/ (pgTAP),
│                            templates/ (the sign-in code email)
├── .env.example             Which Supabase server a build uses; copy to .env.development.local and .env.production.local
├── .claude/                 Claude Code setup: skills, subagents, hooks (see "Working with Claude Code")
├── plugins/
│   ├── withCmakeVersion.js  Config plugin: newer CMake so Windows builds handle long paths
│   └── withImageColorsJvmTarget.js  Config plugin: builds react-native-image-colors' Kotlin for Java 17
├── scripts/
│   ├── pull-db.js           Copies the phone's database to db-snapshot/
│   └── car-park-sql.js      Writes the Supabase migration for the car park list (npm run carparks:sql)
├── assets/                  App icons and splash image
├── .github/workflows/ci.yml GitHub Actions: lint and tests, and Supabase migrations, on push and pull request
├── app.json                 Expo config: name, Android package, plugins
├── jest.config.js           Jest setup (jest-expo preset, Malaysia time zone)
├── PLAN.md                  Full build plan
├── AGENTS.md                Rules for AI coding agents
└── CLAUDE.md                Points Claude Code at AGENTS.md
```

Not in git, created on your machine: `node_modules/` (`npm ci`), `android/` (`npx expo run:android`), `.expo/` (Expo cache), `db-snapshot/` (`npm run db:pull`), `.env.development.local` and `.env.production.local` (from `.env.example`) and `supabase/.temp/` and `supabase/.branches/` (Supabase CLI).

## What to install (once per laptop)

| Install | Notes |
|---|---|
| Node.js LTS | Includes `npm` and `npx` |
| Git | |
| Android Studio | Android SDK, Platform-Tools (`adb`) and a bundled JDK 21 |
| CMake 3.31.6 | Android Studio → Settings → Android SDK → SDK Tools → tick "Show Package Details" → CMake 3.31.6. Required on Windows |
| DBeaver or DB Browser for SQLite | Optional, to open the database on your laptop |

Then set up the environment:

1. **Environment variables** (Windows, user variables), then open a new terminal:
   - `ANDROID_HOME` = `%LOCALAPPDATA%\Android\Sdk`
   - `JAVA_HOME` = `C:\Program Files\Android\Android Studio\jbr` (JDK 21; a newer Java such as 25 on `PATH` is too new for Gradle)
   - Add `%ANDROID_HOME%\platform-tools` to `Path`
2. **Windows long paths**, in PowerShell as administrator, then restart:
   ```powershell
   New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force
   ```
3. **Short project path** with no spaces, for example `C:\dev\park-yourself`.
4. **Phone:** Developer options and USB debugging on, connected by a data USB cable. `adb devices` must list it as `device`.

Step-by-step details, including macOS and phone-brand notes, are in [PLAN.md](PLAN.md), section "Before you start: install from zero".
## Getting started

```bash
git clone https://github.com/jiahui567/parkyourself.git C:\dev\park-yourself
cd C:\dev\park-yourself
npm ci                    # install exact package versions from package-lock.json
npx expo run:android      # generate android/, build, install on the phone
```

The first build takes a while. After that:

- **Day to day:** `npx expo start`, then open the app on the phone. JavaScript changes reload instantly.
- **Rebuild** with `npx expo run:android` only after adding a library with native code or changing `app.json` plugins.
- **Add packages** with `npx expo install <package>`, not `npm install`, so versions match SDK 58.

## Scripts

| Command | What it does |
|---|---|
| `npm start` | Starts the Expo dev server |
| `npm run android` | Builds and installs the development build on the connected phone |
| `npm run release` | Builds and installs the release build on the connected phone, which runs without the laptop (see "Release APK") |
| `npm run lint` | Runs ESLint on `src/` and `test/`, including import order and the 120-character limit for code lines. Add `-- --no-cache` if a result looks stale |
| `npm test` | Runs the Jest tests: rules, display text, the data layer on Node's SQLite, and a load check of every screen. No phone needed. `npm test -- --coverage` also writes a coverage report to `coverage/`, which git ignores |
| `npm run db:pull` | Copies the database (and its `-wal` file) from the phone into `db-snapshot/` |

`npm run ios` and `npm run web` come from the Expo template and are not used yet.

## Version 2 server (Supabase)

In progress (milestones C1, C2 and C10 in PLAN.md: on local, not pushed yet). The app works without it. What talks to it so far: the daily download of the car park list and the rate reports waiting for review (signed out, at most once a day when the app opens, in every build), and, only when the user taps, sign-in and rate reports. Database check shows which server the build uses.

**Rate reports, as the moderator:** open Studio (local: http://127.0.0.1:54323; hosted: the dashboard) → Table Editor → `rate_report`, and the photo under Storage → `report-photos` (`<user id>/<report id>.jpg`). To approve, add the rate to `carParkList.json` as above and push it; then set the report's `status` to `approved` (or `rejected`), which stamps `reviewed_at` and takes it off everyone's "Not verified yet" line the next day. Changing rows is fine in Studio; changing tables is not. `npm run carparks:sql` updates car parks in place, so their reports stay; taking a car park off the list deletes its reports, so delete their photos in Studio first.

**Sign-in emails:** on local they land in Mailpit, http://127.0.0.1:54324. Hosted dev, once per project, in the dashboard (Authentication → Emails, email settings rather than schema): put `{{ .Token }}` in the **Magic link** and **Confirm signup** templates, like `supabase/templates/sign_in_code.html`, or the email carries a link the app cannot use. Keep **Confirm email** on (Authentication → Sign In / Providers → Email, on by default): without it anyone could sign up with a password for an email they do not own. Supabase's own sender only emails your project's team, a few an hour; that is enough for testing.

**The car park list** lives in `src/carparks/carParkList.json` (the one source), on Supabase (`car_park`, `car_park_rate`: anyone may read, only migrations write) and as a copy on the phone. To change a rate, add a row with the new `effective_from` (keep the old one), bump `version`, run `npm run carparks:sql`, check on local, and push. Phones get it within a day.

**Once per laptop:** turn on WSL 2 (`wsl --install --no-distribution` as administrator, then restart) and install Docker Desktop (`winget install Docker.DockerDesktop`, WSL 2 backend). The Supabase CLI comes with `npm ci`. Then `npx supabase login` and `npx supabase link --project-ref <dev project ref>` (asks for the dev database password), and copy `.env.example` to `.env.development.local`.

| Command | What it does |
|---|---|
| `npx supabase start` / `stop` | Starts or stops local Supabase in Docker (Docker Desktop must be running). `stop` keeps the data. Studio: http://127.0.0.1:54323, Mailpit (sign-in emails): http://127.0.0.1:54324. After a change to `supabase/config.toml` (such as Storage turned on for C10), `stop` and `start` again |
| `npx supabase migration new <name>` | Creates an empty migration file in `supabase/migrations/` |
| `npx supabase db reset` | Rebuilds the local database from every migration, then `supabase/seed.sql` |
| `npx supabase test db` | Runs the pgTAP tests in `supabase/tests/` against local |
| `npx supabase db push --linked --dry-run` | Lists the migrations hosted dev does not have yet; drop `--dry-run` to push them |
| `adb reverse tcp:54321 tcp:54321` | Lets the phone reach local Supabase over USB (again after reconnecting the phone) |
| `npm run carparks:sql` | Writes a migration that puts `src/carparks/carParkList.json` on the server. Run it after every change to the list (bump its `version`), then `db reset`, `test db` and push |

**Which server the app uses:** `.env.development.local` (development builds) has a local block and a hosted dev block; keep one uncommented and fully reload the app. `.env.production.local` (release builds) points at hosted dev. Copy both from `.env.example`. Never put a secret key (`sb_secret_...`) or the database password in it. Never change a hosted schema in the Supabase dashboard: write a migration (PLAN.md, "Version 2").

## Database

The database is `park-yourself.db` in the app's private storage (`files/SQLite/`).

| Table | Holds | Synced in version 2 |
|---|---|---|
| `vehicle` | Your cars | Yes |
| `place` | Saved car parks | Yes |
| `place_rate` | Weekday, weekend and public holiday rates per place | Yes |
| `public_holiday` | Dates that use the holiday rate | Yes |
| `parking_session` | Each time you park | Yes |
| `photo` | Pillar photos (file paths and OCR text) | No, phone only |
| `setting` | Preferences for this phone | No, phone only |
| `car_park`, `car_park_rate` | The car park list, a copy of the download or the built-in list | No, downloaded only |
| `car_park_report` | Rate reports waiting for review, a copy of the daily download | No, downloaded only |

Rules the data layer enforces (see `src/db/core.js`):

- Screens never run SQL. They call functions exported from `src/db/index.js`.
- Every row gets a UUID `id`, `created_at` and `updated_at`. Times are UTC epoch milliseconds.
- Synced tables are never `DELETE`d: deleting sets `deleted_at`, and every read skips deleted rows. The one exception is display only: a past session keeps showing its place's name after the place is deleted.
- Multi-step writes use `inTransaction(db, async (txn) => ...)`, and every query inside uses `txn`, not `db`.

**Changing the schema:** add a new step at the end of `MIGRATIONS` in `src/db/migrations.js`. Never edit a step that has already run on a phone. The app refuses to open a database whose schema is newer than it knows, so install the newer app rather than downgrading.

**Self-test:** in development builds, the Database check screen runs `src/db/selfTest.js` against a throwaway database and shows PASS or FAIL for each rule, including what only the phone's driver can show (WAL mode, the second connection used by transactions).

**Tests in CI:** `npm test` also runs the migrations and the data functions (cars, places, holidays, sessions, preferences) against Node's built-in SQLite through `test/testDatabase.js`, so a broken migration or query fails on GitHub before it reaches the phone.

## Checking the data from your laptop

- **Live:** Android Studio → App Inspection → Database Inspector, with the phone on USB. Browse tables and run SQL.
- **Copy:** `npm run db:pull`, then open `db-snapshot/park-yourself.db` in DBeaver or DB Browser for SQLite. Do not use `adb exec-out ... > file` in Windows PowerShell; it corrupts the file.
- **Export:** Settings → Export database shares a copy (through Google Drive, email or any app) that you open on the laptop. It also works on a release build.
- Both need a development (debuggable) build. `db-snapshot/` is in `.gitignore` because it holds your parking data.

## Native code

- `android/` is generated by Expo (Continuous Native Generation). Do not edit it by hand; change `app.json` or add a config plugin in `plugins/`.
- `plugins/withCmakeVersion.js` points the Android build at CMake 3.31.6, whose Ninja handles Windows long paths. Without it, React Native's C++ build fails with `ninja: error: mkdir`.
- `plugins/withImageColorsJvmTarget.js` sets `react-native-image-colors`' Kotlin target to Java 17. The library sets none for the current Android Gradle Plugin, and the build otherwise fails with "Inconsistent JVM-target compatibility" (Java 17, Kotlin 21).
- The Android package is `com.parkyourself.app`. Changing it later installs a separate app that cannot see the old database.

## Release APK

A release build has the JavaScript inside it, so the app runs without the laptop or `npx expo start`.

1. Back up first: in the app, Settings → Export database, and save the copy somewhere safe.
2. Run `npm run lint` and `npm test`.
3. Connect the phone by USB with USB debugging on, as for the development build.
4. Build and install it: `npm run release` (short for `npx expo run:android --variant release`). It replaces the development build on the phone and keeps its data: both have the package `com.parkyourself.app` and are signed with the same key.
   - To only build the file: `cd android; .\gradlew.bat assembleRelease`. The APK is `android\app\build\outputs\apk\release\app-release.apk`; install it with `adb install -r` and that path, or copy it to the phone.
5. Unplug the phone and open Park Yourself.

Good to know:
- The release build is signed with Android's shared debug key (`android/app/debug.keystore`, the same in every prebuild). That is fine for your own phone, not for Google Play or for giving the app to others; those need your own release key (part of M8).
- Android only updates an app with a build signed by the same key. A build signed with another key has to be installed after an uninstall, which deletes the app's data, so export the database first.
- `npm run db:pull` and Android Studio's Database Inspector need a debuggable build. With the release build installed, use Settings → Export database instead.
- To go back to developing, run `npx expo run:android`: the development build replaces the release build and keeps the data.

## Troubleshooting

| Problem | Fix |
|---|---|
| `ninja: error: mkdir(...)` during the build | Install CMake 3.31.6, enable Windows long paths, keep the project in a short path |
| Gradle or Java version error | Point `JAVA_HOME` at Android Studio's `jbr` folder (JDK 21) |
| `No Android connected device found` | Run `adb devices`, accept the USB debugging prompt on the phone, try another cable |
| A native change or new library has no effect | Run `npx expo run:android` again |
| `npm test` fails to load `node:sqlite` (the `src/db` suites) | Node is older than 22.13 or is 23.0 to 23.3, where `node:sqlite` needs a flag. Use Node 22 (`.nvmrc`), or add `node-options=--experimental-sqlite` to your user `~/.npmrc` |
| "Compressed folder is invalid" when moving the project as a zip | Do not zip `node_modules/` or `android/`. Move the project with git (push, then clone or pull) |

## Working with Claude Code

- `AGENTS.md` holds the project rules every AI agent follows: JavaScript only, PLAN.md as the source of truth, the data layer and migration rules, money in sen, UTC times, local-first privacy, dependency rules, code style and what to check before finishing.
- `CLAUDE.md` contains only `@AGENTS.md`, so Claude Code reads the same rules as other tools.
- Decisions live in `PLAN.md`. Update it when a decision changes.

**Skills** (`.claude/skills/`) are recipes Claude loads when a task matches; you can also type `/name`:

| Skill | Use |
|---|---|
| `add-screen` | Steps for a new screen, and the design standard: theme colours, spacing, shapes, type sizes, components, wording |
| `add-migration` | Changing the database schema safely, with the tests to update |
| `next-milestone` | Working through a PLAN.md milestone from plan to phone check |
| `capture-lesson` | Records your corrections as rules (runs by itself, see below) |

**Subagents** (`.claude/agents/`): `reviewer` reviews uncommitted changes against the rules and never edits; `test-writer` writes and runs Jest tests.

**Hooks** (`.claude/settings.json`, which also turns on the Expo plugin):

| Hook | What it does |
|---|---|
| Before an edit | Blocks changes to `android/`, `ios/`, `db-snapshot/` and `node_modules/`, and tells Claude why |
| When you send a message | If it looks like a correction ("wrong", "don't", "instead", "jangan", "salah"...), reminds Claude to run `capture-lesson` |
| When Claude finishes | If code changed since the last passing check, runs lint and tests; on failure Claude gets the error and one round to fix it |

**How it keeps improving:** when you correct Claude, `capture-lesson` writes the rule into the matching skill or subagent, or into the Lessons section of `AGENTS.md`, and tells you in one line. You commit those changes with your work, so every later session follows them. A rule that keeps being broken is better as a test or a hook.

The hooks run with Node.js. On Windows they run in Git Bash, which comes with Git for Windows.

## License

`LICENSE` is the MIT licence that came with the Expo project template (copyright Expo). Replace it with your own before publishing the app.
