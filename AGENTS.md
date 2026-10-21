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
npm run lint                # lint
npm test                    # Jest tests (time zone pinned to Asia/Kuala_Lumpur in jest.config.js)
npm run db:pull             # copy the phone's database into db-snapshot/
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

## Navigation

- Expo Router for all navigation. Routes live in `src/app/`: every file there is a screen, and `_layout.js` files define navigators.
- Keep non-route code outside `src/app/`, and never put tests or helpers there (every file in it becomes a route): shared components in `src/components/`, hooks in `src/hooks/`, data access in `src/db/`, display text in `src/text/`, zone colours in `src/zone/`, OCR parsing in `src/ocr/`.
- Screens stay thin: rules and text live in the tested modules above; a screen only loads, shows and saves. Load data with `useFocusedLoad` so it refreshes when the user comes back to the screen.
- Import `Link`, `router` and `useLocalSearchParams` from `expo-router`.

## Data

- Only `src/db/` runs SQL. Screens import functions from `src/db/index.js`.
- Synced tables (`vehicle`, `place`, `place_rate`, `public_holiday`, `parking_session`): ids come from `newId()`, writes go through the helpers in `src/db/core.js`, rows are soft-deleted (`deleted_at`) and never `DELETE`d, and every read skips deleted rows.
- `photo` and `setting` are local-only and never sync.
- A schema change is a new step at the end of `MIGRATIONS` in `src/db/migrations.js`. Never edit a step that has already run on a phone. Add a `src/db/selfTest.js` check for every new data rule.
- Multi-step writes use `inTransaction(db, async (txn) => ...)`, and every query inside uses `txn`, not `db`.
- Always bind values with `?`. Never build SQL text from user input.
- Test data functions in Jest with `openMigratedTestDatabase()` from `test/testDatabase.js` (Node's built-in SQLite). `src/db/selfTest.js` stays for behaviour only the phone's driver shows.
- Money is integer sen (RM 3.00 = `300`). Never use floats for money.
- Times are stored as UTC epoch milliseconds. Convert to local time only for display and for deciding weekday, weekend or public holiday.

## Fees

- Fee logic lives in pure functions in `src/fees/`, with no database or React code. Screens call `calcStayFee` and `dayTypeOf` from `src/fees/index.js`; they never compute fees themselves.
- Rates passed to the fee functions are `place_rate` rows (snake_case columns), the same shape stored in `rate_snapshot`.
- Every row of the fee test table in PLAN.md is a Jest test in `src/fees/calcFee.test.js`. Change the table and the tests together.
- Tests build times in local phone time; a test about local versus UTC dates uses an explicit UTC instant (`Date.parse('...Z')`).

## Privacy (local-first)

- No network calls except ones the user starts: Share, and Open in Google Maps.
- No analytics, ads or crash-reporting SDKs without asking.
- Photos never leave the phone.
- Never commit `db-snapshot/` or any real parking data.

## Native code and dependencies

- `android/` and `ios/` are generated (Continuous Native Generation). Never create or edit them by hand; configure native behaviour in `app.json` or a config plugin in `plugins/`.
- Keep `plugins/withCmakeVersion.js`: Windows builds need it for long paths.
- Expo Go is not supported. After adding a library with native code or changing `app.json` plugins, say that `npx expo run:android` is needed.
- Ask before adding a dependency, and say why it is needed. Prefer Expo modules over third-party libraries.

## Code style

- Function components and hooks. Styles with `StyleSheet`. No UI library without asking.
- One screen per file in `src/app/`.
- Format money with `formatRM` / read typed amounts with `parseRM` (`src/lib/money.js`), and dates and durations with `src/lib/time.js`; never format inline.
- No empty `catch` blocks: show the user an error or rethrow.
- Comments explain why, not what.
- UI text is English.

## Finishing a task

- Run `npm run lint` and `npm test`. If the database changed, the self-test must pass on the phone. Say clearly what was not run on a device.
- Add every new screen to the `ROUTES` list in `test/routes.test.js`.
- Stay inside the task: no unrelated refactors or renames.
- Update README.md when setup or commands change, and tick the milestone in PLAN.md when it is done.
- Never commit, push or force-push unless asked.
- When PLAN.md does not answer a question, ask instead of guessing.
