---
name: add-screen
description: Use before adding or changing any Park Yourself screen (a file under src/app/) or its styling. Holds the design standard (colours, spacing, shapes, type sizes, components, wording) and the steps to add a screen that loads, saves and is tested the project's way.
---

# Add or change a screen

Status: design standard version 3. Version 2 (dark and light theme, bottom tabs, Home with the car drawing) was confirmed by the user on the phone on 2026-10-22; the Principles were added the same day, after the user found the Park, Find and History redesign simpler and better. When the user corrects how a screen looks or behaves, the capture-lesson skill updates this file.

## Steps

1. Read PLAN.md, section "Screens", for what the screen must show.
2. Before writing code, list every field, button and line of text the screen would show, and run the list through the Principles below: cut, prefill, fold or move each one that most uses do not need. Say in one line what was folded or moved and why.
3. Create the route file. The file name is the URL: `park.js` is `/park`, `session/[id].js` is `/session/123`; the `(tabs)` folder does not appear in the URL. A main section with its own tab goes in `src/app/(tabs)/` and is added to `src/app/(tabs)/_layout.js`; a detail screen (Park, Find, Found my car, Sessions, Places, Public holidays, Cars, Add a car, Rename car) goes outside `(tabs)` and opens above the tab bar. Default-export one function component named after the screen. Never put tests or helpers in `src/app/`.
4. Titles: a detail screen sets its title with `<Stack.Screen options={{ title: '...' }} />` inside the screen; a tab screen gets its title from `Tabs.Screen` in `(tabs)/_layout.js`.
5. Styles come from the active theme, never from a hex:
   ```js
   const styles = useThemedStyles(createStyles); // inside the component, before any early return

   const createStyles = (c) => // at module level, so styles rebuild only when the mode changes
     StyleSheet.create({
       card: { backgroundColor: c.card, borderRadius: radius.card, padding: 16, boxShadow: c.shadow },
       title: { fontSize: 17, fontWeight: '600', color: c.text },
     });
   ```
   For a colour passed as a prop (an icon's `color`, `placeholderTextColor`), use `const { colours } = useAppTheme();`. Both come from `src/components/ThemeProvider.js`. A file whose styles use no colour may use a plain module-level `const styles = StyleSheet.create(...)`.
6. Load data with `useFocusedLoad` so it refreshes when the user comes back:
   ```js
   const load = useCallback(() => sessions.getDetails(db, id), [db, id]);
   const { data, error, loading } = useFocusedLoad(load);
   if (error) return <ErrorText error={error} />;
   if (loading) return null;
   if (!data) return <ErrorText error={new Error('This parking session no longer exists.')} />;
   ```
7. Keep rules out of the screen. SQL goes in `src/db/`, fees in `src/fees/`, display text in `src/text/`, money and dates in `src/lib/`. New logic gets its own module and a Jest test first; the screen only loads, shows and saves.
8. Saving: disable the button and show "Saving…" while it runs, show the error under the form with `ErrorText`, then navigate. After creating a record use `router.replace(...)` so Back does not return to the form; after editing use `router.back()` (or `router.replace('/')` when `router.canGoBack()` is false).
9. Add the route to `ROUTES` in `test/routes.test.js`.
10. Run `npm run lint` and `npm test`, then tell the user exactly what to check on the phone, in both dark and light mode.

## Design standard (version 3)

**Look**: clean, minimal and tech-forward, like Apple Health or the Tesla app. Charcoal and white, with emerald kept for the main action, selected states and positive status (Parked, Default, PASS). Never use emerald for decoration or headings.

**Principles**: simple, minimal and modern. Every screen is checked against these before it is built (step 2) and in review.
- **One job, one main action.** Say what the screen is for in one sentence; everything on it serves that. The one main action is the only full-width button, placed last.
- **Essentials first, the rest folded.** Show only what most uses need. Optional parts are folded `Disclosure` rows that show their value when closed ("Timer · Off", "Weekday rate · RM 3.00 first hour…", "Not set · optional") and open on tap. Park at the car is a place, a photo and Save.
- **Ask when the user knows.** Ask for something at the moment the user has the answer, on the screen where they are then: the first shop is asked on Find while walking out, not on Park at the car.
- **Fewer fields to type.** Before adding a field, try in this order: read it (OCR, a saved rate), prefill the common case (60-minute periods), offer chips, fold it under "More options". Typing is the last resort.
- **Familiar patterns.** Use what people know from the apps they use daily rather than a new control: a gallery button beside the camera's shutter, as in WhatsApp; folded rows with a chevron, as in iOS Settings.
- **Lead with what people scan for.** The first line of a card is what the list is searched by (the place in History); group long lists with a summary in the header (the month's total).
- **Say it once.** Leave out what is the same on every row (the car's name when there is one car) or already in the title. No helper text that repeats a label.
- **Quiet visuals.** No decoration, gradients or extra colours; one emerald accent; secondary text in `muted`; hairlines between rows rather than boxes in boxes; generous spacing (the Spacing rules below).
- **Small edits save themselves.** Where a screen has no Save for it (Find's way back), a chip saves on tap and a field when it is left. Anything that loses data still asks first.
- 2026-10-22: Design every screen simple, minimal and modern, by the Principles above, because the user found the redesign that applied them (folded optional rows, way back on Find, gallery in the camera, History by month) clearly better than a form with every field open.

**Theme**: dark mode is the default. The user picks Dark or Light in Settings; the choice is saved in the `setting` table under `theme` and applies to the whole app at once.

**Colours**: tokens in `src/components/theme.js`, one set per mode with the same keys. Add a new token to both sets rather than writing a hex in a screen; `theme.test.js` checks that the sets match and that text pairs are readable.

| Token | Dark | Light | Use |
|---|---|---|---|
| `background` | `#0E1013` | `#F5F6F8` | Screen background, headers |
| `card` | `#171A1F` | `#FFFFFF` | Cards, tab bar, selected segment |
| `surface` | `#1F2329` | `#EEF0F3` | Inputs, chips, secondary buttons, icon buttons, car icon circles |
| `text` | `#F2F4F5` | `#1F2328` | Body text and titles |
| `muted` | `#8B929A` | `#5F6670` | Secondary text, inactive tabs, overlines, empty states, "Coming soon" rows |
| `border` | `#2A2F36` | `#DDE1E6` | Dividers, input and chip outlines, swatch outlines, hairlines |
| `primary` | `#10B981` | `#10B981` | Emerald fill: the main button, the round Park button, the parked dot |
| `onPrimary` | `#03140D` | `#03140D` | Text and icons on `primary` |
| `accent` | `#34D399` | `#047857` | Emerald text and icons: selected tab and chip, "Default", "Parked", PASS |
| `accentSoft` | `#123528` | `#D1FAE5` | Behind `accent`: selected chip, status pill, tonal button, "Coming soon" badge |
| `danger` | `#F87171` | `#C62828` | Errors, archive and delete |
| `warning` | `#FBBF24` | `#A14A07` | Amber text: the "Estimate" pill, "Overnight: check your receipt" |
| `warningSoft` | `#3A2A0A` | `#FEF3C7` | Behind `warning`: the "Estimate" pill, the overnight highlight |
| `shadow` | 1 px light ring | soft drop shadow | `boxShadow` on every card (shadows do not show on dark backgrounds, so dark mode uses a ring) |
| `primaryGlow` | emerald glow | emerald glow | `boxShadow` under the round Park button only |
| `backdrop` | `#000000` | `#000000` | Behind the camera and a full-screen photo (the same in both modes) |
| `onBackdrop` | `#FFFFFF` | `#FFFFFF` | Text, icons and the shutter on `backdrop` |
| `backdropSoft` | translucent black | translucent black | Round buttons over the camera preview (`BackdropButton`) |
| `car.*` | | | The Home car drawing (`CarLogo`) only |

Every `Text` gets a colour from the theme: a `Text` without one is black, which disappears in dark mode.

**Spacing**: screen padding 16; gap between blocks 12, written as the `space` token (a 12 inside a row, such as icon to text, stays a number), 20 to 24 between sections; inside a card padding 16 (list rows 12 to 14 top and bottom) and gap 6 to 10.

**Shapes** (`radius` in `theme.js`): cards 16 (`radius.card`) with `boxShadow: c.shadow`; large buttons and inputs 12 (`radius.control`); chips, small buttons, status pills and icon buttons are pills (`radius.pill`); colour swatches are circles with a `border` outline. A list of settings or cars is one card with hairline dividers between rows; a list of records (History) is one card per record.

**Type**: Home car name 32/800 with letter spacing -0.6, under an overline (11/700, uppercase, letter spacing 2.4, `muted`, a short hairline each side); tab screen titles 26/700, left-aligned; the one value the screen is about (level on Find) 56/800; a parked spot on Home 24/700; bay 28/700; card titles 16 to 18/600; section titles 12/600, uppercase, letter spacing 0.8, `muted`; labels 600; body at the default size. Secondary text uses `muted`.

**Navigation**: bottom tabs Home, History, Spending and Settings. Tab icons are line icons from `icons.js`; the selected tab is `accent` with an `accentSoft` pill behind its icon. Home has no header and pads itself below the status bar; the other tabs show a large left-aligned title. Detail screens open above the tab bar from the root stack. Headers use `background` with no shadow.

**Home**: one car at a time. The car drawing at the top (emerald glow when parked, grey otherwise), the overline and name, a status pill ("Parked · 1h 05m" in `accent` on `accentSoft`, or "Not parked" in `muted` on `surface`), then the spot card when parked. The round Park button sits at the bottom centre and becomes Find when the car is parked. With several cars, pill chips at the top switch cars and a green dot marks each parked car.

**Components** (in `src/components/`):
- `Button`: variants `primary`, `secondary` (grey), `tonal` (soft emerald) and `danger` (red outline); sizes `large` (full width) and `small` (a pill sized to its label); optional `icon`.
  - `large` `primary` is for the screen's one main action, placed last.
  - 2026-10-22: Only a screen's one main action (Save, Found my car) is a full-width `Button`. Side actions in lists use `size="small"` pills or an `IconButton` (archive, delete), and "Add" buttons are small `tonal` pills, because the user found full-width list buttons too big and long and wants a sharp, elegant look.
- `IconButton`: round, 36 px with a 48 px touch area, icon only. Always pass `label` ("Archive My Myvi") for screen readers; `tone="danger"` for archive and delete.
- `SegmentedControl`: one of two to four options with one always selected (Dark / Light).
- `ChipGroup`: one choice from a few options (up to about 12). Tapping the selected chip clears it. When a row label outside the chips says what they are (Park's "Level" and "Bay" rows of photo codes), give each option an `accessibilityLabel` ("Level G3").
- `Field`: labelled text input on `surface`. Codes such as level and bay use `autoCapitalize="characters"`. Under a row that already names it (a `Disclosure`), leave out `label` and pass `accessibilityLabel`.
- `ErrorText` for every error the user should see.
- `RateForm`: edits one rate (Hourly or Flat) as typed strings; check it with `rateFromForm` and show the error with `ErrorText`, since the form shows none. It shows only the prices; period lengths, free minutes and daily max are under "More options", which starts open when the rate uses them (decided when it mounts, so give a form that can switch day type a `key`).
- `Disclosure`: a card row (label, optional icon, a short `value` at the end or a `muted` `hint` under the label, a chevron) that opens to show its children. The screen keeps `open`, so it can open the row itself for an error inside. Put rows in a card with `overflow: 'hidden'`; pass `first={false}` to every row after the first.
  - Use it for every optional part of a form (Principles, "Essentials first, the rest folded").
- `SwitchRow`: a label, optional `muted` hint and a themed switch; the whole row toggles. It has no side padding, so wrap it in a padded View inside a card.
- `EstimatePill`: the amber "Estimate" pill beside a fee that may differ from the receipt (overnight, or a borrowed rate). Never emerald.
- `ListSection` and `ListRow` (`List.js`): the Settings card list. A row with `onPress` shows a chevron; one without is read-only with a `muted` label. Pass `first={false}` to every row after the first.
- `icons.js`: line icons on a 24 grid, stroke 2, shapes from Lucide drawn with `react-native-svg`. Add new icons there; no icon library.
- `CarLogo`: the Home car drawing; `active` turns its glow emerald.
- `CameraCapture`: a full-screen camera in a `Modal` that asks for the permission and takes one photo, or picks one with the gallery button beside the shutter (also offered when the camera is not allowed); mount one per screen and pass the picture to `preparePhoto`. `PhotoStrip`: a row of 3:4 thumbnails, oldest (the pillar sign) first. `PhotoViewer`: full-screen photos, swiped, with optional share and delete buttons. `PhotoStrip` takes `disabled` while a photo is being prepared or read. `BackdropButton`: the round icon button used over the camera and photos.
- Delete, archive and other actions that lose data always ask first with `Alert.alert` (Cancel plus a `destructive` button).
- Lists use `FlatList` with a `ListEmptyComponent` sentence in `muted`; each row opens its detail with `router.push`. History uses a `SectionList` by month, with section-title-styled headers that show the month's total.
- `SessionCard`: one finished session, the place first, then date and duration, the spot and the amount; pass `showVehicle={false}` when the car's name would repeat on every card.
- `WayBackCard`: Find's way back while parked (how you left, first shop), a `Disclosure` that saves each part as it is given.
- Planned features show as `muted` rows with the value "Soon", or a card with an `accentSoft` "Coming soon" badge.

**Zone colour**: draw with `swatchFor(name)`, put text on a swatch in `textColourOn(swatch)`, and always show the colour name as text too, so colour is never the only signal.

**Accessibility**: `accessibilityRole` on everything pressable (`button`, `radio`); touch targets at least 44 px (use `hitSlop` for small controls); icon-only buttons have an `accessibilityLabel`; text contrast at least 4.5:1, and 7:1 for body text, checked in `theme.test.js`.

**Words**: English, sentence case, short. Money with `formatRM`, times with `formatTime`, `formatDate` and `formatDuration`; never format inline.
- 2026-10-22: A placeholder must never look like a value. An example starts with "e.g." ("e.g. B2", "e.g. 3.00", "e.g. My Myvi"); otherwise use a word such as "Optional". Never "0.00" in a money field. The user read the Level placeholder "B2" as a level already filled in from the photo.

**Known gaps** (check on the phone):
- `app.json` still has `"userInterfaceStyle": "light"`, so Android draws system dialogs (`Alert.alert`) and the launch screen light, even in dark mode. Changing it needs a rebuild.
- With 3-button navigation, the system navigation bar icons may not follow the theme. `expo-navigation-bar` would fix it; ask before adding it.
- Long forms (Park, Found my car, a place's rates) wrap their ScrollView in `KeyboardAvoidingView behavior="padding"` with `keyboardVerticalOffset={useHeaderHeight()}` (from `expo-router/react-navigation`), because Android draws edge to edge and no longer shrinks the window for the keyboard. Not yet checked on the phone (2026-10-22); the tab bar at large font sizes is untested too.
