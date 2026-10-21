# Park Yourself

An Android app that remembers where you parked and what it will cost.

Take a photo of the pillar sign and the app reads the level, bay number and zone colour. Add the first shop you saw after the lift or escalator, and the app shows you the way back. It remembers each car park's weekday, weekend and public holiday rates, calculates the fee while you are away, reminds you before paid parking runs out, lets you share your spot through WhatsApp, and shows your monthly parking spend.

All data stays on the phone. No account, no server. An optional cloud sync is planned for version 2.

## Status

| | |
|---|---|
| Built | **M0 Setup**: Expo SDK 58 project, development build on Android, SQLite data layer with migrations, UUID ids, soft delete, and a self-test screen |
| Built ahead | **M2 fee logic** (`src/fees/`): day type, fee per day, whole-stay fee with overnight estimate and borrowed rates; money and date formatters (`src/lib/`). Covered by Jest tests, including every row of the PLAN.md fee table. The M2 screens are not built yet |
| Next | **M1**: vehicles, Park and Find screens, history |
| Plan | [PLAN.md](PLAN.md) has every decision, the screens, the fee rules, the data model, milestones M0 to M8 and the version 2 cloud design |

The home screen is currently a temporary M0 status screen (database info and self-test results). M1 replaces it.

## Features (version 1)

- **Park:** pillar photo, level and bay read by on-device OCR, zone colour picked from the photo, lift/escalator/stairs, first shop seen, note.
- **Find:** photo, level and bay on the zone colour, and the route back in reverse ("Find Starbucks → escalator → B2 → blue zone, pillar C14").
- **Saved places and rates:** a place remembers its weekday and weekend rates and an optional fixed public holiday amount, and fills them in next time.
- **Fee:** calculated live; stays past midnight are shown as an estimate; you can record the amount actually paid.
- **Notifications:** ongoing notification with Navigate and Extend timer, plus a reminder before the timer ends.
- **Share:** the spot as a WhatsApp message with the photo, or as a QR code.
- **Monthly spending:** totals by month, place and car.
- **Several cars**, optional one-shot GPS, works fully offline.

## Tech stack

| Area | Choice |
|---|---|
| Framework | Expo SDK 58, React Native 0.88, React 19.3 |
| Language | JavaScript (no TypeScript) |
| Navigation | Expo Router, screens in `src/app/` |
| Database | `expo-sqlite`, plain SQL, migrations tracked by `PRAGMA user_version`, WAL mode, foreign keys compiled on |
| IDs | `expo-crypto` (`randomUUID()`) |
| Camera and photos | `expo-camera`, `expo-image-manipulator`, `expo-file-system` |
| Notifications | `expo-notifications` |
| Location (optional) | `expo-location` |
| Sharing and export | `expo-sharing` |
| Drawing | `react-native-svg` |
| Build | Expo development build (`expo-dev-client`), built locally with Android Studio's SDK. Expo Go is not supported |
| Lint | ESLint 9 with `eslint-config-expo` |
| Tests | Jest 30 with the `jest-expo` preset, time zone pinned to `Asia/Kuala_Lumpur` in `jest.config.js` |
| CI | GitHub Actions (`.github/workflows/ci.yml`): lint and tests on every push and pull request to `master` |

Added at the milestone that needs them: an ML Kit OCR wrapper and `react-native-image-colors` (M4), `react-native-share` and `react-native-qrcode-svg` (M5), `react-native-gifted-charts` (M6).

## Project structure

```
park-yourself/
├── src/
│   ├── app/                 Screens (Expo Router): every file is a screen
│   │   ├── _layout.js       Root layout, opens the database
│   │   └── index.js         Home screen (temporary M0 status screen)
│   ├── fees/                Fee rules: pure functions, no database or React
│   │   ├── calcFee.js       Fee per day and per stay (overnight estimate, borrowed rates)
│   │   └── dayType.js       Weekday, weekend or public holiday
│   ├── lib/                 Shared helpers
│   │   ├── money.js         formatRM ("RM 3.00") and parseRM (typed text to sen)
│   │   └── time.js          Local date key, next midnight, time/date/duration text
│   └── db/                  Data layer: the only code that runs SQL
│       ├── index.js         What screens import
│       ├── core.js          Insert, update, soft delete, transactions, UUIDs
│       ├── migrations.js    Schema steps, applied in order
│       ├── migrate.js       Applies migrations on app start
│       ├── selfTest.js      Checks the data layer rules (development builds)
│       └── vehicles.js, places.js, sessions.js, photos.js, holidays.js, settings.js
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
| `npm run lint` | Runs ESLint |
| `npm test` | Runs the Jest tests (fee rules, formatters). No phone needed |
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
- Synced tables are never `DELETE`d: deleting sets `deleted_at`, and every read skips deleted rows.
- Multi-step writes use `inTransaction(db, async (txn) => ...)`, and every query inside uses `txn`, not `db`.

**Changing the schema:** add a new step at the end of `MIGRATIONS` in `src/db/migrations.js`. Never edit a step that has already run on a phone. The app refuses to open a database whose schema is newer than it knows, so install the newer app rather than downgrading.

**Self-test:** in development builds, the M0 screen runs `src/db/selfTest.js` against a throwaway database and shows PASS or FAIL for each rule.

## Checking the data from your laptop

- **Live:** Android Studio → App Inspection → Database Inspector, with the phone on USB. Browse tables and run SQL.
- **Copy:** `npm run db:pull`, then open `db-snapshot/park-yourself.db` in DBeaver or DB Browser for SQLite. Do not use `adb exec-out ... > file` in Windows PowerShell; it corrupts the file.
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
| "Compressed folder is invalid" when moving the project as a zip | Do not zip `node_modules/` or `android/`. Move the project with git (push, then clone or pull) |

## Working with Claude Code

- `AGENTS.md` holds the project rules every AI agent follows: JavaScript only, PLAN.md as the source of truth, the data layer and migration rules, money in sen, UTC times, local-first privacy, dependency rules, code style and what to check before finishing.
- `CLAUDE.md` contains only `@AGENTS.md`, so Claude Code reads the same rules as other tools. Add new rules to `AGENTS.md`, ideally each time you correct an agent's mistake.
- `.claude/settings.json` turns on the Expo plugin for Claude Code.
- Decisions live in `PLAN.md`. Update it when a decision changes.

## License

`LICENSE` is the MIT licence that came with the Expo project template (copyright Expo). Replace it with your own before publishing the app.
