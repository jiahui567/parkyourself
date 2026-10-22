# Park Yourself

An Android app that remembers where you parked and what it will cost.

Take a photo of the pillar sign and the app reads the level, bay number and zone colour. Add the first shop you saw after the lift or escalator, and the app shows you the way back. It remembers each car park's weekday, weekend and public holiday rates, calculates the fee while you are away, reminds you before paid parking runs out, lets you share your spot through WhatsApp, and shows your monthly parking spend.

All data stays on the phone. No account, no server. An optional cloud sync is planned for version 2. The one thing that reaches the internet by itself is Google ML Kit, which reads the pillar sign: it sends Google anonymous usage metrics (see "Tech stack", OCR).

## Status

| | |
|---|---|
| Built | **M0 Setup**: Expo SDK 58 project, development build on Android, SQLite data layer with migrations, UUID ids, soft delete, and a self-test screen |
| M1 in testing | Screens: Home (one car at a time, round Park button), Add a car (first run), Park (level, bay, zone colour, note), Find (way back, Found my car), History, Cars (default, rename, archive) and Settings, behind a bottom tab bar. Dark mode by default, Light in Settings. Data functions for cars and sessions are tested in CI. Running on the phone as a development build. The pillar photos (built 2026-10-22, not yet on the phone): several per session on Park, shown on Find and in History, tap to view full screen, share or delete one, Add photo while parked. Renaming a car (built 2026-10-22). Redesign (built 2026-10-22, not yet on the phone): Park's rate, timer and note fold away, the way back is added on Find while parked, photos can come from the gallery, and History is grouped by month with totals |
| Built, not yet on the phone | **M2 Places, rates and fees** (place picker, weekday/weekend rates, public holiday amount and list, live fee, overnight Estimate, Amount paid), **M3 Notifications** (timer on Park, Extend timer on Find; an ongoing notification per parked car with the start time and Navigate and Extend timer buttons, which open the app; reminders before and at the timer's end; the reminder lead time in Settings), **M4 OCR** (the first photo is read on the phone with `expo-mlkit-ocr`; level and bay chips fill the fields), **M5 Share** (the parking info as a message from Find, or one photo from the photo view; no QR code), **M6 Monthly spending** (Spending tab with the 12-month chart, tap through to a month's sessions) and the **M8 Settings** screen (Places, Public holidays, Extend timer by, Export database). Needs a fresh `npx expo run:android`: the chart and OCR have native code, and the camera and notification permissions are set in `app.json` |
| Built ahead | **M4 colour logic**: zone colour names from a hex (`src/zone/`), covered by Jest tests. The colour suggestion from the photo and tap-to-pick are not built yet |
| On hold | **M7 GPS**, while its design is rethought |
| Next | Rebuild with `npx expo run:android`, run the new screens, photos, OCR, sharing and notifications on the phone and fix what shows up; then the rest of M4 (colour from the photo) and M8 |
| Plan | [PLAN.md](PLAN.md) has every decision, the screens, the fee rules, the data model, milestones M0 to M8 and the version 2 cloud design |

The M0 status screen (database facts and the self-test) is now **Database check**, under Settings → Developer in development builds.

## Features (version 1)

- **Park:** pillar photo (camera or gallery), level and bay read by on-device OCR, zone colour picked from the photo. The rate, timer and note fold away until you need them.
- **Find:** photo, level and bay on the zone colour, and the route back in reverse ("Find Starbucks → escalator → B2 → blue zone, pillar C14"). While parked, you add how you left and the first shop as you walk out.
- **Saved places and rates:** a place remembers its weekday and weekend rates and an optional fixed public holiday amount, and fills them in next time.
- **Fee:** calculated live; stays past midnight are shown as an estimate; you can record the amount actually paid.
- **Notifications:** ongoing notification with Navigate and Extend timer, plus a reminder before the timer ends.
- **Share:** the parking info as a message, or one photo, through WhatsApp or any app.
- **Monthly spending:** totals by month, place and car.
- **Several cars**, optional one-shot GPS, works fully offline.
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
| Location (optional) | `expo-location` |
| Drawing | `react-native-svg`, also for the icons and the Home car drawing (no icon library) |
| Charts | `react-native-gifted-charts` with `expo-linear-gradient` (its gradient peer dependency), for the Spending tab's 12-month bar chart. `expo-linear-gradient` has native code: after pulling it in, run `npx expo run:android` again |
| Theme | Own dark and light colour sets in `src/components/theme.js`; the choice is saved in the `setting` table. Design rules in the `add-screen` skill |
| Build | Expo development build (`expo-dev-client`), built locally with Android Studio's SDK. Expo Go is not supported |
| Lint | ESLint 9 with `eslint-config-expo` |
| Tests | Jest 30 with the `jest-expo` preset, time zone pinned to `Asia/Kuala_Lumpur` in `jest.config.js`. Data layer tests run `src/db` on Node's built-in SQLite (`test/testDatabase.js`) |
| CI | GitHub Actions (`.github/workflows/ci.yml`): lint and tests on every push and pull request to `master` |

Added at the milestone that needs it: `react-native-image-colors` (the rest of M4, approved). M5 needs no extra library; the QR code was dropped.

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
│   │   │   └── settings.js  Dark/Light, Cars, Places, Public holidays, Extend timer, Export, Database check
│   │   ├── park.js          Park: place and rate, photos, level, bay, zone colour, timer, note
│   │   ├── session/[id].js  Find: the spot, the way back (added here while parked), fee so far, Extend timer,
│   │   │                    Found my car / Delete
│   │   ├── session/end/[id].js  Found my car summary: fee, missing rate, Amount paid
│   │   ├── sessions.js      One month's sessions for a place or car (from Spending)
│   │   ├── places/          Places list and a place's rates (edit, delete)
│   │   ├── holidays.js      Public holiday dates
│   │   ├── vehicles/        Cars list (default, archive), Add a car, Rename car ([id].js)
│   │   └── debug.js         Database check (development builds)
│   ├── components/          Theme (theme.js, ThemeProvider.js), Button, IconButton, ChipGroup,
│   │                        SegmentedControl, Field, ErrorText, icons, CarLogo, RateForm,
│   │                        SwitchRow, List (ListSection, ListRow), PlacePicker, SessionCard,
│   │                        EstimatePill, CameraCapture, PhotoStrip, PhotoViewer, BackdropButton,
│   │                        Disclosure (folded rows), WayBackCard (Find's way back while parked)
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
│   ├── lib/                 Shared helpers
│   │   ├── money.js         formatRM ("RM 3.00"), formatAmountInput ("3.00") and parseRM
│   │   ├── time.js          Local date and month keys, time/date/month/duration text
│   │   ├── placeName.js     Whether a typed place name is new
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
│       └── vehicles.js, settings.js
├── test/                    Jest helpers: Node SQLite test database, setup, screen-load check
├── .claude/                 Claude Code setup: skills, subagents, hooks (see "Working with Claude Code")
├── plugins/
│   └── withCmakeVersion.js  Config plugin: newer CMake so Windows builds handle long paths
├── scripts/
│   └── pull-db.js           Copies the phone's database to db-snapshot/
├── assets/                  App icons and splash image
├── .github/workflows/ci.yml GitHub Actions: lint and tests on push and pull request
├── app.json                 Expo config: name, Android package, plugins
├── jest.config.js           Jest setup (jest-expo preset, Malaysia time zone)
├── PLAN.md                  Full build plan
├── AGENTS.md                Rules for AI coding agents
└── CLAUDE.md                Points Claude Code at AGENTS.md
```

Not in git, created on your machine: `node_modules/` (`npm ci`), `android/` (`npx expo run:android`), `.expo/` (Expo cache) and `db-snapshot/` (`npm run db:pull`).

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
| `npm run lint` | Runs ESLint on `src/` and `test/`, including import order and the 120-character limit for code lines. Add `-- --no-cache` if a result looks stale |
| `npm test` | Runs the Jest tests: rules, display text, the data layer on Node's SQLite, and a load check of every screen. No phone needed. `npm test -- --coverage` also writes a coverage report to `coverage/`, which git ignores |
| `npm run db:pull` | Copies the database (and its `-wal` file) from the phone into `db-snapshot/` |

`npm run ios` and `npm run web` come from the Expo template and are not used yet.

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
- The Android package is `com.parkyourself.app`. Changing it later installs a separate app that cannot see the old database.

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
