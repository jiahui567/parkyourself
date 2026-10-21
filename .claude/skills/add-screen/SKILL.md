---
name: add-screen
description: Use before adding or changing any Park Yourself screen (a file under src/app/) or its styling. Holds the design standard (colours, spacing, shapes, type sizes, components, wording) and the steps to add a screen that loads, saves and is tested the project's way.
---

# Add or change a screen

Status: version 1, written before any screen was tested on a phone. When the user corrects how a screen looks or behaves, the capture-lesson skill updates this file.

## Steps

1. Read PLAN.md, section "Screens", for what the screen must show.
2. Create the route file in `src/app/`. The file name is the URL: `park.js` is `/park`, `session/[id].js` is `/session/123`. Default-export one function component named after the screen. Never put tests or helpers in `src/app/`.
3. Set the header title with `<Stack.Screen options={{ title: '...' }} />` inside the screen.
4. Load data with `useFocusedLoad` so it refreshes when the user comes back:
   ```js
   const load = useCallback(() => sessions.getDetails(db, id), [db, id]);
   const { data, error, loading } = useFocusedLoad(load);
   if (error) return <ErrorText error={error} />;
   if (loading) return null;
   if (!data) return <ErrorText error={new Error('This parking session no longer exists.')} />;
   ```
5. Keep rules out of the screen. SQL goes in `src/db/`, fees in `src/fees/`, display text in `src/text/`, money and dates in `src/lib/`. New logic gets its own module and a Jest test first; the screen only loads, shows and saves.
6. Saving: disable the button and show "Saving…" while it runs, show the error under the form with `ErrorText`, then navigate. After creating a record use `router.replace(...)` so Back does not return to the form; after editing use `router.back()` (or `router.replace('/')` when `router.canGoBack()` is false).
7. Add the route to `ROUTES` in `test/routes.test.js`.
8. Run `npm run lint` and `npm test`, then tell the user exactly what to check on the phone.

## Design standard (version 1)

**Colours**: only from `src/components/theme.js`; add a new token there rather than writing a hex in a screen.

| Token | Value | Use |
|---|---|---|
| `primary` | `#1E5BD8` | Main buttons, links, selected chips |
| `text` | `#1A1A1A` | Body text |
| `muted` | `#666666` | Secondary text, empty states |
| `border` | `#D0D0D0` | Inputs, chips, swatch outlines |
| `card` | `#F2F2F2` | Card backgrounds |
| `danger` | `#C62828` | Errors, delete and archive |
| `background` | `#FFFFFF` | Screen background |

**Spacing**: screen padding 16; gap between blocks 12 (`space`); inside a card padding 16 and gap 6 to 10.

**Shapes**: cards radius 12; buttons and inputs radius 8; chips are pills (radius 16); colour swatches are circles with a `border` outline.

**Type**: the one value the screen is about (level on Find) 56/800; a parked spot on Home 24/700; bay 28/700; card titles 17 to 18/600; labels 600; body at the default size. Secondary text uses `muted`.

**Components** (in `src/components/`):
- `Button`: `primary` for the screen's one main action, placed last; `secondary` for side actions; `danger` for delete and archive.
- Delete, archive and other actions that lose data always ask first with `Alert.alert` (Cancel plus a `destructive` button).
- `ChipGroup` for choosing one of a few options (up to about 12). Tapping the selected chip clears it.
- `Field` for text input. Codes such as level and bay use `autoCapitalize="characters"`.
- `ErrorText` for every error the user should see.
- Lists use `FlatList` with a `ListEmptyComponent` sentence in `muted`; each row is a card that opens its detail with `router.push`.

**Zone colour**: draw with `swatchFor(name)`, put text on a swatch in `textColourOn(swatch)`, and always show the colour name as text too, so colour is never the only signal.

**Accessibility**: `accessibilityRole` on everything pressable (`button`, `radio`); touch targets at least 44 px tall (the `Button` padding gives this).

**Words**: English, sentence case, short. Money with `formatRM`, times with `formatTime`, `formatDate` and `formatDuration`; never format inline.

**Known gaps**: `ChipGroup`'s selected background `#E8EEFB` and the white text on primary buttons are literals; move them into `theme.js` the next time those files change. No dark mode yet (milestone M8). Keyboard avoidance on long forms is untested.
