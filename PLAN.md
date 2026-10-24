# Park Yourself: build plan

Last updated: 2026-10-23. Status: M0 to M7 are done, checked on the phone by the user on 2026-10-23. M8 is in progress: Settings and Export database are built; the app icon, dark system dialogs and the release APK are left. Working name in earlier drafts: Parking Saver.

An Android app (iPhone later) that remembers where you parked: a photo of the pillar sign, the level, bay number and zone colour read from that photo, the first shop you saw after leaving the lift or escalator, and a note. It remembers each car park's rates (weekday, weekend, and an optional fixed public holiday amount), calculates the fee, reminds you before paid parking runs out, lets you share your spot with someone, and shows your monthly parking spend. It supports several cars. All data stays on the phone.

## How to use this file

1. On your personal laptop, create a folder such as `~/projects/park-yourself` and copy this file into it as `PLAN.md`.
2. Install everything in "Before you start: install from zero" and pass the toolchain test there.
3. Answer the questions under "Open questions → Still open" and add your own details anywhere else.
4. Start Claude Code in that folder and say: "Read PLAN.md and start milestone M0."

Package names and versions below were written from memory on 2026-10-20. Check that they are current at the start of M0, and check each extra library at the milestone that first uses it.

## Decisions made

| Topic | Decision |
|---|---|
| App name | Park Yourself |
| Platform | Android first. Keep code cross-platform so an iPhone build is possible later |
| Language | React Native (Expo) with plain JavaScript, no TypeScript. Flutter was considered and not chosen (previous experience with Flutter + SQLite was not enjoyable) |
| Currency and app language | RM only, English only |
| Look and theme | Decided 2026-10-22. Clean, minimal look in the style of Apple Health and the Tesla app: charcoal and white, emerald only for the main action and positive states such as Parked. Dark mode by default; Light can be picked in Settings and is saved on the phone. Bottom tab bar: Home, History, Spending, Settings. Colours, type and components are in `.claude/skills/add-screen/SKILL.md`. Decided 2026-10-22: every screen is simple, minimal and modern, by the Principles in that skill (essentials first, optional parts folded, ask when the user knows, fewer fields to type) |
| Data | Version 1: stored only on the phone (SQLite). No account, no server. Version 2 adds optional cloud sync and sharing (see "Version 2: Park Yourself Cloud") |
| Database IDs and deletes | Prepared for version 2 from day one: every row has a UUID text id made on the phone, an `updated_at` time, and is soft-deleted (`deleted_at`) instead of removed, so sync can be added later without rewriting the data layer |
| GPS | Redesigned 2026-10-23, simplified 2026-10-24 (M9). Optional: one switch in Settings, **Use location when parking**, which asks Android's permission when turned on. While on and allowed, Park reads the location when it opens and uses it to fill in the place and to save where the car is. No per-park switch, no continuous or background tracking. See "Location" |
| Floor detection (barometer) | Dropped. Not accurate enough to trust |
| Pillar photo | Core feature. On-device OCR reads the level and bay number from the photo. Decided 2026-10-22: a session can have several photos. The first is the pillar photo; the others help you remember the place. OCR reads the first photo, and reads the next only if the first gives no level or bay. Also decided 2026-10-22: a photo can be picked from the gallery, with a button beside the camera's shutter (`expo-image-picker`, Android's own photo picker, no storage permission) |
| Pillar zone colour | Many malls colour their pillars by zone. The app suggests the colour from the photo, you confirm it, and it is saved as data (name and hex) so it shows as a big swatch, in the notification and in the share message |
| Route note | Core feature. Record whether you used the lift, escalator or stairs, and the first shop you saw when you came out. Decided 2026-10-22: added on Find while parked, as you walk out, not on Park, because you have not seen the shop yet when you save at the car |
| Free-text note | Always available. On Park it is a folded row (2026-10-22) |
| Park form | Decided 2026-10-22: at the car, parking takes a place, a photo and Save. Everything optional is a folded row that shows its value and opens when tapped: the rate (under the place), the timer and the note |
| Place search | Decided 2026-10-22: saved places only, searched on the phone, for now. You usually tap Park in a basement with weak or no signal, so the local search must stay the main path. Decided 2026-10-23: with the location allowed, Park fills in a saved place near you, and for a new place looks its name up online with Android's geocoder (no API key; it sends the location to Google). Online suggestions while typing (type "pavi", get matching malls) are still not planned: they need a provider (Google Places: API key and billing; OpenStreetMap: free, weaker coverage) and send what you type |
| Photos | Stay on the phone only, in version 2 too; never uploaded, to avoid cloud storage cost. Kept until you delete them. Delete button per photo and per session |
| Vehicles | Cars only, no motorbike type and no plate number. You can add more than one car. Each session belongs to one car. One active session per car |
| Saved places | Type a place name such as "Pavilion Bukit Jalil" the first time. The rate you enter is saved to that place. Next time you pick the place and the rate fills in. A deleted place keeps its name on past sessions (History, Find, Spending); the place picker and the Places list skip it |
| Rates | Saved per place for weekday and weekend. A "same rate every day" shortcut saves both at once. A rate is optional when parking: a rate form left empty saves no rate and no fee is calculated; a half-filled form is an error. Decided 2026-10-22: the rate form shows only the two prices (first hour, each hour after); the period lengths, free minutes and daily max are under **More options**, which starts open when a saved rate uses them; **Fewer options** folds them away again (2026-10-23) |
| Public holidays | Use the weekend rate by default. Optionally, a place can have a fixed public holiday amount (for example RM 8.00 per entry), which is used instead. Holiday dates are typed as `YYYY-MM-DD` (no date picker library), with a "Today" shortcut and an optional name |
| Stays over midnight | Rare, and every car park has its own rules, so the app does not model them. It shows a clearly labelled estimate (each day charged at that day's rate and added) and you confirm the real amount paid from your receipt when you end the session. Per-car-park overnight rules are a later idea |
| Fee | Calculated live while parked. When you end the session you can type the amount you actually paid if it differs (validation discount, lost ticket). The amount paid is stored only when it differs from the calculated fee; with no calculated fee (no place or no rate), a typed amount is stored and an empty field stores nothing |
| Sharing | Share your spot through WhatsApp or any app: the parking info as a message (map link if GPS saved), or a photo on its own. Only when you tap Share; the app never uploads anything by itself. Decided 2026-10-22: no QR code, and no extra library (the message and the photo are shared separately) |
| Monthly spending | Spending screen with monthly totals, breakdown by place and by vehicle, and a 12-month chart |
| Notifications | Ongoing notification per parked vehicle with **Navigate** and **Extend timer** buttons. Reminder 10 minutes before the timer ends and at the end. Extend adds 30 minutes to the later of the timer's end and now; with no timer yet it starts one from now. Settings changes the Extend amount (15, 30 or 60 min) and the reminder lead time (5, 10, 15 or 30 min). Decided 2026-10-22: built with `expo-notifications`, not Notifee. It cannot show a ticking clock, so the notification shows the start time ("since 2:15 PM") and the timer end but no fee; the live fee stays in the app. **Navigate** and **Extend timer** both open the app (Extend extends the timer as it opens Find), so no background task is needed |
| Laptop DB access | Must be able to inspect the SQLite tables from a laptop (see "Checking the database from your laptop") |

## User flow

**First run**
1. Add your first car: a name such as "My Myvi". It becomes the default car.

**Parking** (camera first, decided 2026-10-24, milestone M9: the goal is that Park needs no typing at all; everything is filled in and only the note is optional)
- Tap **Park** on Home: the camera opens at once. Take the photo of the pillar sign (or pick one with the gallery button), and the Park form opens behind it already filled in: place and rate from the location (when **Use location when parking** is on in Settings), level, bay and zone colour from the photo. **Skip photo** (top right of the camera) opens the form with no photo, for open-air or street parking; closing the camera (X or Back) returns to Home with nothing saved.
- **Save** is pinned at the bottom of the form, like Found my car, so it is in sight without scrolling. Everything stays editable; **Note** is the one optional folded row.
- The timer and the location are set once in Settings, not on each park: **Timer when parking** (an hours-and-minutes wheel since M10; 0 h 00 m is Off, the default) starts on every park; **Use location when parking** reads the location each time Park opens, fills in the place and saves where the car is. On Find, **Extend timer** still adds time and **Stop timer** drops the timer for this park.
- Steps 2 to 5 below describe the parts of the form; where they mention Park's Timer and Location rows, those moved to Settings as above.

1. Open the app and tap the round **Park** button on Home. The default vehicle shows first; with several vehicles, tap another one's chip at the top to switch.
2. Pick the place: recent places are listed first, or search ("bukit" finds Pavilion Bukit Jalil), or type a new name. The rate shows as one folded line under the place (for example `Weekday rate · RM 3.00 first hour, then RM 2.00 per hour`, or `Not set · optional`); tap it to open the form. A rate that needs checking when you tap Save opens it for you.
   - **Saved place with a rate for today's day type:** the rate fills in.
   - **New place, or no rate yet for today's day type:** open the rate line and enter the rate. It is saved to the place automatically, without asking. Tick **Same rate every day** to save it for weekday and weekend at once. If you don't know the rate, leave it closed or empty: no rate is saved and no fee is calculated.
   - **You change a filled-in rate:** the app asks "Update the saved weekend rate for Pavilion Bukit Jalil?" with **Yes, update**, **Only this time** or **Cancel** (back to the form, nothing saved). Either of the first two parks with the rate you typed.
   - **Today is a public holiday:** decided 2026-10-23, Park has no Public holiday switch or amount. When today is in your holiday list (Settings > Public holidays), the rate line says **Public holiday rate** and the place's fixed public holiday amount is used if you saved one (in Settings > Places), otherwise the weekend rate. A holiday not in the list is charged as a normal day.
   - **No place** is allowed for free or unknown parking; no fee is calculated.
   - **A name typed but not picked:** Save asks first, `Park at "Pavilion" as a new place?` (or `Park at "Pavilion Bukit Jalil"?` when it matches a saved place), with **Use it**, **No place** or **Cancel**, so a fee is never lost by forgetting to tap the place. **Use it** parks there with the place's saved rates (none for a new place; Found my car then asks for the rate). The same question comes up when a place was picked, then **Change** was tapped and a different name typed but not picked; its buttons are then **Use it**, **Keep "Pavilion"** (the place picked before) and **Cancel**.
3. Take a photo of the pillar or level sign, or pick one with the gallery button beside the shutter. OCR reads the codes on the sign (for example `B2` and `C14`) and offers each one in a Level row and a Bay row. With two codes, one tap does both: tap `C14` as the bay and `B2` becomes the level, or the other way round; tapping the other row swaps them. The fields stay editable.
4. Confirm the zone colour: the app suggests one (for example **Blue**). Tap the pillar in the photo to pick its colour exactly, choose another colour chip, or choose **None**.
5. Optional, each a folded row: **Timer** (`Off` until you open it and pick 30 min, 1, 2, 3 or 4 hours from when you save), **Note**, and **Location** (`Off` with an Allow location button until allowed; then the reading's accuracy, such as `±12 m`, and a **Save where I parked** switch). With the location allowed, the place in step 2 is filled in for you (see "Location").
6. Tap **Save**. The ongoing notification appears: `My Myvi · Pavilion Bukit Jalil · B2 C14 Blue · since 2:15 PM`.

**Walking out** (decided 2026-10-22)
- Find opens after Save, with its **Way back** card open. As you walk out, tap how you left the car park (Lift, Escalator, Stairs or Other) and type the first shop you see (for example "Starbucks"). Each is saved as you give it; there is no Save button. Next time Find opens, the card is folded and shows the way back.

**While away**
- The notification shows when you parked and when the timer ends. The elapsed time and the fee so far are in the app, which stays current.
- **Extend timer** (on Find, and on the notification, where it opens Find) adds 30 minutes (or your default) to the later of the timer's end and now, and reschedules the reminders. With no timer yet, it starts one that ends 30 minutes from now.
- A reminder fires 10 minutes (or your default) before the timer ends, and again when it ends.

**Returning**
- Tap **Navigate** (notification or app). The Find screen shows the photo, the level and bay in large text on a swatch of the zone colour, and the route back in reverse:
  `Find Starbucks → take the escalator beside it → B2 → blue zone, pillar C14`
- **Share** sends the parking info, or one photo, to someone (see "Share your spot").
- If a location was saved for this session (or its place has one), **Open in Google Maps** gives walking directions to it.
- Tap **Found my car**. A summary screen shows the duration and the calculated fee, with an **Amount paid** field prefilled with that fee. Its end time is fixed when the summary opens, so the fee shown is the fee saved. Change the amount if you paid a different amount, then confirm. The session moves to history.
- If the stay went past midnight, the fee is labelled **Estimate** on the Find screen, and the summary highlights the Amount paid field with "Overnight: check your receipt".

## Screens

| Screen | Contents |
|---|---|
| Tab bar | Home, History, Spending and Settings, at the bottom of every main screen. Park, Find, Vehicles and the other detail screens open above it |
| Home | One vehicle at a time: a drawing of a car at the top (glowing emerald when parked), the vehicle's name, and a **Parked** or **Not parked** status. When parked, a card with the level and bay on the zone colour, the start time, the way back and (from M2) the fee so far. A round **Park** button at the bottom centre, which becomes **Find** when that vehicle is parked. With several vehicles, chips at the top switch between them and a green dot marks each parked one |
| Park | Opens on the camera (gallery button, Skip photo, X back to Home). Then: place picker with the rate as a folded line under the place (opens to the rate form) and a muted line when the location filled it in or could not, photos with Add photo, OCR result chips, level and bay fields, zone colour chips, Note as a folded row, and Save pinned at the bottom (M9, 2026-10-24; the Timer and Location rows moved to Settings) |
| Find | Level and bay on the zone colour swatch; while parked, the Way back card (how you left and the first shop, saved as you go; open until one is given), afterwards the reverse route; photos (tap to zoom, share or delete one) and Add photo while parked, elapsed time, live fee, Set timer (the wheel in a sheet, counting from now; M10), Extend timer, Stop timer (when there is one; asks first; M9), Share, Open in Google Maps (while parked, when the session or its place has a location), and Found my car pinned at the bottom so it shows without scrolling. The level reads "Level B2" and the bay is its code alone ("C14"), decided 2026-10-23 |
| Found my car | Summary opened from Find (`/session/end/<id>`): the stay's times, duration and fee (with the Estimate label), a form for each missing rate (optional), Amount paid, Save. Back to Home afterwards |
| History | Past sessions in months, newest first. Each month's header shows its total and number of sessions, and opens that month on Spending. Each card leads with the place, then the date, time and duration, the level/bay with the zone colour, the car (only with several cars) and the amount paid. Tap to view details and photo. Delete photo or session. Filters by vehicle, place and month are not built yet (2026-10-22); Spending opens one place's or car's sessions for a month instead |
| Spending | Month switcher, monthly total, number of sessions, hours parked, breakdown by place and by vehicle, 12-month bar chart (tap a bar to pick that month). Tap a place or vehicle to open that month's sessions |
| Sessions | One month's sessions for one place (or "No place") or one vehicle, opened from Spending as `/sessions?month=YYYY-MM` with `placeId=<id>` (`none` for no place) or `vehicleId=<id>`. Opens above the tab bar |
| Places | Saved places with visit count. Tap to edit the weekday rate, weekend rate and public holiday amount, rename or delete |
| Public holidays | Your holiday dates, by date. Add a date typed as `YYYY-MM-DD` (with a "Today" shortcut) and an optional name; delete a date |
| Vehicles | Add, edit, set default, archive (archived vehicles keep their history) |
| Settings | Appearance (Dark or Light), Cars, Places, Public holidays, Timer when parking (an hours-and-minutes wheel, 0 h 00 m is Off and the default; M9, wheel M10), Use location when parking (a switch; turning it on asks Android's permission; M9), Extend timer by (15, 30 or 60 min, default 30) and Remind me before the timer ends (5, 10, 15 or 30 min, default 10) as folded rows showing their value (2026-10-23), with an Allow notifications button when they are off, Export database. Development builds also link to Database check |

## Saved places and rates

- A **place** is a name you type, such as "Pavilion Bukit Jalil". Names are unique and matched without case, so "pavilion bukit jalil" is the same place.
- A place has up to three saved rates:

  | Day type | Rate | If not saved |
  |---|---|---|
  | Weekday | Full rate (hourly or flat) | Asked for when you park on a weekday |
  | Weekend | Full rate (hourly or flat) | Asked for when you park on a weekend |
  | Public holiday | Optional fixed amount per entry | Weekend rate is used |

- **Day type:** Monday to Friday is a weekday, Saturday and Sunday are the weekend, and any date in your public holiday list is a public holiday (even on a weekend).
- **Public holiday list:** dates you add in Settings (typed as `YYYY-MM-DD`). Park no longer adds one (2026-10-23). Stored on the phone; no internet calendar.
- **Optional rate:** a rate form left empty when parking saves no rate, and the fee is unknown. A form with only some prices typed is an error, shown under the form.
- **Auto-save:** a rate entered for a combination that has none is saved without asking. Changing a saved rate asks first (Yes, update / Only this time / Cancel), because a one-off promotion should not overwrite the normal rate. The same rule applies to the public holiday amount.
- **Rates change over time:** each session keeps a copy of the rates it used (`rate_snapshot`): all the place's saved rates when you park, with the rates typed on Park in place of the saved ones for those day types, also after "Only this time". Updating a place's rate later never changes past fees or monthly totals.
- **Missing rate later in a stay:** if a stay runs into a day type with no saved rate (parked Friday night, only a weekday rate saved, collected Saturday), the Find screen shows "Estimate uses the weekday rate" and the Found my car summary asks for the weekend rate (optional; left empty, the fee stays the estimate). The summary asks only for the rates the stay actually needed: weekday for a weekday, weekend for a weekend day, and weekend for a public holiday with no holiday amount. A stay at a place with no rate at all (the rate was left empty on Park) gets the same optional forms, so the fee can still be worked out. Parking with no place never asks. The rate is used for this stay and saved to the place only if the place still exists and still has no rate for that day type; otherwise it is used for this stay only, and the summary says so.
- **Deleted places:** deleting a place soft-deletes it and its rates. Past sessions keep showing its name (History, Find, Spending); the place picker and the Places list no longer show it.

## Fee calculator

**Fields in each rate**

| Field | Example | Notes |
|---|---|---|
| Type | Hourly | `hourly` or `flat` (fixed price per entry) |
| First period | 60 min at RM 3.00 | |
| Each block after | 60 min at RM 2.00 | Charged per block or part of a block |
| Grace period | 15 min | A stay this long or shorter is free. Both types have one: a flat-price car park often lets a short stop leave free |
| Daily cap | RM 20.00 | Optional maximum per day |
| Flat price | RM 5.00 | Only for `flat` type |

Store money as integer sen (RM 3.00 = `300`) so the sums never have floating-point errors.

**One day**

```
function calcDayFeeSen(minutes, rate):
  if rate.type == 'flat': fee = rate.flatSen
  else:
    fee = rate.firstSen
    remaining = minutes - rate.firstMinutes
    if remaining > 0:
      fee += ceil(remaining / rate.blockMinutes) * rate.blockSen
  if rate.dailyCapSen: fee = min(fee, rate.dailyCapSen)
  return fee
```

**Whole stay**

Most stays end the same day, and the result is the exact fee for the saved rate. For a stay past midnight the result is only an estimate, because each car park has its own overnight rules. The app labels it **Estimate** and you confirm the amount paid from your receipt.

```
function calcStayFeeSen(start, end, rates, holidays):
  if minutesBetween(start, end) <= rates.firstDay.graceMinutes: return 0
  fee = 0
  for each calendar-day piece [pieceStart, pieceEnd] of [start, end]:   // split at midnight
    if pieceEnd == pieceStart: continue                                  // ended exactly at midnight
    dayType = dayTypeOf(pieceStart.date, holidays)          // 'weekday' | 'weekend' | 'holiday'
    rate = rates[dayType]
    if dayType == 'holiday' and rate is missing: rate = rates.weekend
    fee += calcDayFeeSen(minutesBetween(pieceStart, pieceEnd), rate)
  return fee
```

How the overnight estimate works: a new day starts at midnight, each day is priced on its own including the first-period price, and the daily cap applies per day. The grace period applies to the whole stay only.

**Test cases**

Weekday car rate: RM3 first hour, RM2 per hour after, 15 min grace, RM20 cap. Weekend car rate: RM4 first hour, RM3 per hour after, RM25 cap.

| Stay | Fee |
|---|---|
| Tuesday, 10 min | RM 0.00 (grace) |
| Tuesday, 45 min | RM 3.00 |
| Tuesday, 1 h 00 min | RM 3.00 |
| Tuesday, 1 h 01 min | RM 5.00 |
| Tuesday, 2 h 10 min | RM 7.00 |
| Tuesday 09:00 to 21:00 | RM 20.00 (cap; uncapped would be RM 25.00) |
| Saturday, 2 h 10 min | RM 10.00 (weekend rate) |
| Public holiday on a Wednesday, no holiday amount saved, 2 h 10 min | RM 10.00 (weekend rate) |
| Public holiday, fixed holiday amount RM 8.00 saved, 5 h | RM 8.00 |
| Friday 20:00 to Saturday 10:00 | RM 34.00, labelled Estimate: Friday 4 h = RM 9.00, Saturday 10 h = RM 31.00 capped to RM 25.00 |

Write these as Jest tests before the fee screens.

## Vehicles

- Cars only. Fields: name, colour (optional), default flag.
- One active session per car, enforced in the database (see the unique index in the data model).
- Each parked car shows on Home (with several cars, a green dot on its chip) and has its own ongoing notification.
- A car with history is archived, not deleted, so history and monthly totals stay correct.

## Share your spot

- **Share** on the Find screen (while parked) opens the Android share sheet (WhatsApp, Telegram, SMS, email) with this message:

  ```
  My Myvi is parked at Pavilion Bukit Jalil
  Level B2, bay C14, blue zone
  Took the escalator, first shop: Starbucks
  Parked at 2:15 PM
  Map: https://www.google.com/maps/search/?api=1&query=3.0512,101.6789
  ```

  The Map line appears only if the session or its place has a location. The person receiving it needs nothing installed.
- **A photo:** the share button in the full-screen photo view sends that photo on its own. The message and the photo go separately, because React Native's built-in `Share` cannot send text and an image together on Android; that would need `react-native-share`.
- **QR code:** dropped on 2026-10-22.
- **Later, when friends have the app:** a link such as `parkyourself://spot?...` that imports the spot into their app.

## Location

Changed 2026-10-24 (M9): one switch in Settings, **Use location when parking**, replaces Park's Location row and its **Save where I parked** switch. Turning it on asks for Android's permission; while it is on (and allowed), every park reads the location, fills in the place and saves where the car is; off, nothing is read. Park shows a muted line under the place: found from your location, finding, not allowed in Android settings, too rough, not found, or no name found (pick the place). While the place is still empty and no reading is under way, a **Try again** button under the place reads again (for example near the entrance). After Android stops asking, turning the switch on opens the app's Android settings instead, and the switch's hint says so.

Decided 2026-10-23, still true:

- **When it is read.** Only while Park is open, once, when it opens: first the phone's last known position (at most 5 minutes old, and still there in a basement with no signal), then a fresh reading if one comes within 10 seconds. The more precise one is kept. **Try again** reads again. No background or continuous tracking.
- **Usable reading.** Accurate to 200 m or better. A rougher one is neither saved nor used to fill in the place.
- **Filling in the place.** Once, and only while you have not picked or typed a place yourself:
  1. A saved place with a location within 300 m of you (the nearest one) is picked, with its rates.
  2. Otherwise (M11) the nearest car park in the built-in list within 300 m: your saved place of the same name if you have one (also when it has no location of its own), else a new place with all the list's rates, marked "Nearby, from the car park list". No lookup online.
  3. Otherwise Android's geocoder looks up a name online (`reverseGeocodeAsync`): the building or shop name (for example "Sunway Velocity Mall"), or else the street, for parking by the road. House numbers and plus codes are skipped. It becomes a new place, shown as "Found from your location, saved when you park"; tap **Change** if it is wrong. This sends the location to Google (accepted 2026-10-23, AGENTS.md "Privacy"). With no signal the lookup fails, Park says so under the place, and you pick the place as before.
- **Saving.** While Use location when parking is on, a usable reading is saved on the session (`lat`, `lng`, `gps_accuracy_m`). A place gets its location the first time a session there is saved with one, and keeps it, so the next park there finds it offline.
- **Walking back.** While parked, Find shows **Open in Google Maps** with walking directions to the saved location, or to the place's location when the session has none. Useful for open-air and street parking with no pillar. The share message's Map line uses the same location.
- Later idea: a "Save location here" on Find's way back card, for a precise point at the mall entrance when the basement had no signal.

## Monthly spending

- Spending screen: pick a month to see total spent, number of sessions, hours parked, totals by place (highest first) and by vehicle, and a bar chart of the last 12 months.
- Uses the amount paid when one is stored (it is stored only when it differs from the calculated fee), otherwise the calculated fee, otherwise 0: `COALESCE(paid_sen, fee_sen, 0)`.
- A session counts in the month it started, in local phone time.
- Tap a place or vehicle to open the Sessions screen with that month's sessions. A deleted place keeps its name here.

Example query:

```sql
SELECT strftime('%Y-%m', started_at / 1000, 'unixepoch', 'localtime') AS month,
       SUM(COALESCE(paid_sen, fee_sen, 0)) AS total_sen,
       COUNT(*)                         AS sessions
FROM parking_session
WHERE status = 'ended'
  AND deleted_at IS NULL
GROUP BY month
ORDER BY month DESC
LIMIT 12;
```

## OCR for the pillar sign

- Run text recognition on the device (Google ML Kit). Reading needs no internet. Google's ML Kit data disclosure says it also collects per-installation identifiers and diagnostics and usage analytics and sends them to Google over HTTPS; there is no opt-out for text recognition. Accepted on 2026-10-22 as the one exception to "no analytics"; recorded in AGENTS.md, Privacy.
- Shrink the photo first (about 1280 px wide) to save space and speed up OCR.
- Parse the recognised text for:
  - Level: `B1`–`B9`, `P1`–`P9`, `L1`–`L20`, `LG`, `UG`, `G`, `M`, `LL`, and `GF` (ground floor) and `RF` (roof), added 2026-10-23
  - Bay: a zone letter plus number (`C14`, `C-14`, `C 14`) or a number on its own
- Show every candidate as a chip. You tap one for Level and one for Bay. The fields stay editable, and you can skip OCR and type them.
- Decided 2026-10-22, after a sign reading `G3 A2` gave two bay chips and no level: the patterns cannot always tell a level from a bay, so every code read is offered in both rows, the likelier ones first. With exactly two codes, tapping one fills the other field with the code left over, when that field is empty or held the code just tapped (so tapping the other row swaps them). Not when the two are readings of the same characters (`M 12` gives `M` and `M12`). Any other typed value is never replaced.
- Decided 2026-10-23, after real photos picked up car plates and ads beside the pillar: the parser reads each line ML Kit found, with its size on the photo, and:
  - drops lines that are clearly not the sign: car plates (two or three letters then three or four digits, such as `WXY 1234`, or one letter with four digits or a letter after, such as `W 1234 A`; not `LG 12`, `ZON 3` or a zone such as `AA 12`), phone numbers (9 or more digits in one run, so a bay range such as `C101-C120` or `1201-1250` stays), prices (`RM5`), web addresses, and ad words (SALE, PROMO, OFF, CALL, `%`);
  - leaves out small print: codes in text under 35% of the height of the biggest code;
  - ranks the rest by text size, doubled beside a sign word on the same line or the line above (LEVEL, ARAS, TINGKAT, FLOOR for a level; ZONE, ZON, BAY, LOT, PETAK, PILLAR, TIANG for a bay), halved on a line of more than five words (a notice) and for a four-digit number (a year or an ad's number).
- The likeliest level and bay fill the Level and Bay fields when they are empty, with "Filled in below from the photo. Check it, or tap another code." The bay is filled only when the sign also gave a level or a single code (`G3 A2` is left for you to tap), and nothing is filled from two readings of the same characters (`M 12`). Every code on the sign is offered as a chip; lines dropped as not the sign, and small print, give no chips. A typed value is never replaced. Removing a photo keeps what it filled in.
- Save the raw OCR text with the photo, so the parser can be improved later using your real photos.

## Pillar zone colour

The photo itself is always saved in full colour. This feature also records the zone colour as data, because data can be shown big on the Find screen, printed in the notification and the share message, searched in history, and (in version 2) synced to family, while the photo never leaves the phone.

**How the colour is picked** (decided 2026-10-23; the zone colour chip is filled in when it is still empty and you have not picked one, with "Suggested from the photo. Tap another colour if it is wrong.")
1. **Words on the sign:** a colour word in English or Malay (RED/MERAH, ORANGE/OREN/JINGGA, YELLOW/KUNING, GREEN/HIJAU, BLUE/BIRU, PURPLE/UNGU, PINK/MERAH JAMBU, BROWN/COKLAT, GREY/KELABU, WHITE/PUTIH, BLACK/HITAM). Beside ZONE or ZON (or under it) comes first, then on a line with a code, then a line of colour words alone. Words in a brand name or an ad ("RED BULL", "RED SALE") are not used.
2. **Suggestion from the paint:** when the sign names no colour, the app crops the panel around the likeliest code (its OCR box widened by most of its height) and takes that crop's main colour with `react-native-image-colors`, then the nearest named colour. Only a clear colour is suggested: White, Grey and Black are too easily bare concrete or a white light. The paint is read even when the sign names its colour, and its hex is saved with the session whatever name you pick. (Replaces "the most vibrant colour in the photo", which is as likely an ad or a car.)
3. **Tap to pick:** dropped on 2026-10-23. The colour now fills in from the sign, and the chips correct it, so tapping the pillar in the photo is not needed. (It would have cropped about 40 × 40 px around the tap.)
4. **Confirm:** colour chips (Red, Orange, Yellow, Green, Blue, Purple, Pink, Brown, Grey, White, Black, None). The suggested one is highlighted; tap another to change it.
5. Save both the confirmed name (`Blue`) and the picked hex value (`#1E5BD8`) on the session.

Basement lighting (yellow or dim lights) shifts colours, which is why you always confirm the name. The name is what the app shows and shares; the hex is kept so the mapping can be improved later.

**Hex to name** (convert to hue, saturation, lightness)
- Saturation below 15%: Black if lightness below 12%, White above 90%, otherwise Grey.
- Otherwise by hue: Red 345°–15°, Orange 15°–45°, Yellow 45°–70°, Green 70°–170°, Blue 170°–260°, Purple 260°–300°, Pink 300°–345°.
- Orange hue with lightness below 35% is Brown.

**Test cases** (write as Jest tests at M4)

| Hex | Name |
|---|---|
| `#1E5BD8` | Blue |
| `#E53935` | Red |
| `#FDD835` | Yellow |
| `#43A047` | Green |
| `#9E9E9E` | Grey |

## Notifications

- **Ongoing notification** for each parked vehicle: vehicle, place, level, bay, zone colour, the start time and the timer end, and the buttons **Navigate** and **Extend timer**. No fee: the notification cannot update itself, so a fee there would go stale.
- **Timer reminders:** one 10 minutes before the end (default), one at the end.
- Permissions: Android 13+ needs the notification permission at first use. The app asks when Find first opens for a parked car (right after Park), at most once per run of the app; Settings has an Allow notifications button when they are off.

Android behaviour to test on your phone:
- Since Android 14, users can swipe away most ongoing notifications. The Home screen must still show every active session (the green dot on each parked car's chip).
- Android limits exact alarms for most apps, so a reminder can arrive a few minutes late. The lead-time reminder covers this.
- Battery savers on some brands (Xiaomi, Oppo, Vivo, Samsung) can delay or block scheduled notifications. Settings could show a hint to exclude the app from battery optimisation.
- 2026-10-22: `expo-notifications` was chosen over Notifee. The buttons open the app, so it needs no background task (`expo-task-manager`).
- 2026-10-22 (replaced the same day by the line above): notifications were deferred until the app could be built and tested on a phone. The timer, Extend timer and the reminder times (`src/timer/timer.js`, `reminderTimes`) are built and tested without them. Notes from the SDK 58 docs for that decision: `expo-notifications` supports a sticky (ongoing) notification and action buttons, but no ticking chronometer, and a button that works without opening the app needs `expo-task-manager`.

## Data model (SQLite)

Every `id` is a UUID text made on the phone (`Crypto.randomUUID()` from `expo-crypto`). Synced tables carry `created_at`, `updated_at` and `deleted_at`. All times are UTC epoch milliseconds.

```sql
CREATE TABLE vehicle (
  id              TEXT PRIMARY KEY,          -- UUID
  name            TEXT NOT NULL,
  colour          TEXT,
  is_default      INTEGER NOT NULL DEFAULT 0,
  archived        INTEGER NOT NULL DEFAULT 0,
  created_at      INTEGER NOT NULL,          -- epoch ms, UTC
  updated_at      INTEGER NOT NULL,
  deleted_at      INTEGER                    -- set instead of DELETE
);

CREATE TABLE place (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  note            TEXT,
  lat             REAL,                      -- filled the first time GPS is saved here
  lng             REAL,
  last_used_at    INTEGER,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  deleted_at      INTEGER
);

CREATE UNIQUE INDEX place_name_unique
  ON place (name COLLATE NOCASE) WHERE deleted_at IS NULL;

CREATE TABLE place_rate (
  id              TEXT PRIMARY KEY,
  place_id        TEXT NOT NULL REFERENCES place(id),
  day_type        TEXT NOT NULL CHECK (day_type IN ('weekday','weekend','holiday')),
  type            TEXT NOT NULL CHECK (type IN ('hourly','flat')),
  first_minutes   INTEGER,
  first_sen       INTEGER,
  block_minutes   INTEGER,
  block_sen       INTEGER,
  grace_minutes   INTEGER NOT NULL DEFAULT 0,
  daily_cap_sen   INTEGER,
  flat_sen        INTEGER,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  deleted_at      INTEGER,
  CHECK (day_type <> 'holiday' OR type = 'flat')   -- holiday is a fixed amount only
);

CREATE UNIQUE INDEX place_rate_unique
  ON place_rate (place_id, day_type) WHERE deleted_at IS NULL;

CREATE TABLE public_holiday (
  id              TEXT PRIMARY KEY,
  holiday_date    TEXT NOT NULL,             -- 'YYYY-MM-DD'
  name            TEXT,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  deleted_at      INTEGER
);

CREATE UNIQUE INDEX public_holiday_unique
  ON public_holiday (holiday_date) WHERE deleted_at IS NULL;

CREATE TABLE parking_session (
  id              TEXT PRIMARY KEY,
  vehicle_id      TEXT NOT NULL REFERENCES vehicle(id),
  place_id        TEXT REFERENCES place(id),
  status          TEXT NOT NULL CHECK (status IN ('active','ended')),
  started_at      INTEGER NOT NULL,
  ended_at        INTEGER,
  level           TEXT,
  bay             TEXT,
  zone_colour_name TEXT,                     -- confirmed name, e.g. 'Blue'
  zone_colour_hex  TEXT,                     -- colour picked from the photo, e.g. '#1E5BD8'
  access_type     TEXT CHECK (access_type IN ('lift','escalator','stairs','other')),
  landmark        TEXT,                      -- first shop seen
  note            TEXT,
  rate_snapshot   TEXT,                      -- JSON { weekday?, weekend?, holiday? }: fee fields of the rates used
  timer_ends_at   INTEGER,
  fee_sen         INTEGER,                   -- calculated fee, set when ended
  paid_sen        INTEGER,                   -- amount paid, only if it differs from fee_sen (or no fee)
  lat             REAL,                      -- only if GPS saved
  lng             REAL,
  gps_accuracy_m  REAL,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  deleted_at      INTEGER
);

CREATE UNIQUE INDEX one_active_session_per_vehicle
  ON parking_session (vehicle_id) WHERE status = 'active' AND deleted_at IS NULL;

-- Local only, never synced (file paths only mean something on this phone).
-- Rows and image files are deleted for real.
CREATE TABLE photo (
  id              TEXT PRIMARY KEY,
  session_id      TEXT NOT NULL REFERENCES parking_session(id),
  file_uri        TEXT NOT NULL,
  ocr_text        TEXT,
  created_at      INTEGER NOT NULL
);

-- Local only: preferences for this phone.
CREATE TABLE setting (
  key             TEXT PRIMARY KEY,
  value           TEXT
);

-- v2 (M11, 2026-10-24). Local only, never synced: a copy of the car park list
-- (M12: downloaded from Supabase daily, or the copy built into the app until a
-- download has worked). Replaced whole, rows deleted for real, when the list's
-- version or content changed (setting car_park_list_version holds the source,
-- version and a fingerprint); the built-in copy never replaces a download. A
-- failure keeps the old list and never stops the app; Database check shows it.
-- checked_on is when the source was read; since v3 each rate has its own
-- effective_from (car_park_rate below).
CREATE TABLE car_park (
  id              TEXT PRIMARY KEY,           -- stable slug, 'sunway-pyramid'
  name            TEXT NOT NULL,
  area            TEXT,
  lat             REAL,
  lng             REAL,
  source_url      TEXT NOT NULL,
  checked_on      TEXT NOT NULL,              -- 'YYYY-MM-DD'
  notes           TEXT                        -- what the rates leave out
);

-- v3 (M12): rate history. The place_rate fee columns, so the fee code reads
-- both the same way; per day type the app uses the row with the latest
-- effective_from not after today (src/carparks/ratesInEffect.js).
CREATE TABLE car_park_rate (
  car_park_id     TEXT NOT NULL REFERENCES car_park(id) ON DELETE CASCADE,
  day_type        TEXT NOT NULL CHECK (day_type IN ('weekday','weekend','holiday')),
  effective_from  TEXT,                       -- 'YYYY-MM-DD', or null: since before it was first checked
  type            TEXT NOT NULL CHECK (type IN ('hourly','flat')),
  first_minutes INTEGER, first_sen INTEGER, block_minutes INTEGER, block_sen INTEGER,
  grace_minutes INTEGER NOT NULL DEFAULT 0, daily_cap_sen INTEGER, flat_sen INTEGER,
  CHECK (day_type <> 'holiday' OR type = 'flat')
);
CREATE UNIQUE INDEX car_park_rate_unique
  ON car_park_rate (car_park_id, day_type, COALESCE(effective_from, ''));
```

Using the list: a listed car park becomes a place only when you park there, with all its rates (weekday, weekend and holiday, not only today's) copied into `place_rate` as if typed, and from then on the saved place (your rates) wins: search and the location skip listed car parks whose name is already a saved place.

**Data layer rules** (all in one `db/` folder; screens never write SQL themselves):
- Run `PRAGMA foreign_keys = ON;` every time the app opens the database.
- Insert: set `id` (new UUID), `created_at` and `updated_at`.
- Update: always set `updated_at`.
- Delete: set `deleted_at` and `updated_at`; never `DELETE` a synced table. The unique indexes ignore deleted rows, so a deleted place name can be reused.
- Read: every query filters `deleted_at IS NULL`. One exception, for display only: a session's place name is read even when the place was deleted, so past sessions keep showing it.
- Deleting a place also soft-deletes its `place_rate` rows.
- Deleting a session soft-deletes it and really deletes its `photo` rows and image files.
- Version 1 keeps the soft-deleted rows (they are tiny). Version 2 decides when to purge them.

Use plain SQL through `expo-sqlite`, no ORM. Schema changes go through a small migration list tracked by `PRAGMA user_version`, so the schema can change without losing data:

```js
const MIGRATIONS = [
  `CREATE TABLE vehicle (...); CREATE TABLE place (...); ...`,   // v1
  // `ALTER TABLE vehicle ADD COLUMN dirty INTEGER NOT NULL DEFAULT 1; ...`,  // later, version 2 sync
];

export async function migrate(db) {
  await db.execAsync('PRAGMA foreign_keys = ON');
  const { user_version } = await db.getFirstAsync('PRAGMA user_version');
  for (let v = user_version; v < MIGRATIONS.length; v++) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATIONS[v]);
      await db.execAsync(`PRAGMA user_version = ${v + 1}`);
    });
  }
}
```

Never edit a migration that has already run on your phone; add a new one.

## Tech stack

| Need | Choice |
|---|---|
| App framework | Expo (latest SDK) + JavaScript + `expo-router` |
| Build | Expo development build (`expo-dev-client`), needed for OCR. Free on Android |
| Database | `expo-sqlite` with plain SQL and the `PRAGMA user_version` migration list |
| UUIDs | `expo-crypto` (`Crypto.randomUUID()`) |
| Camera, photo resize, crop | `expo-camera`, `expo-image-manipulator`, `expo-file-system` |
| Photo from the gallery | `expo-image-picker` (added 2026-10-22): Android's photo picker, which needs no storage permission. The picked photo is a copy in the app's cache, so preparing it never touches the gallery. Its microphone permission is blocked in `app.json`; its camera permission is left alone, as `expo-camera` needs it |
| OCR | `expo-mlkit-ocr` 0.2.7, pinned (chosen 2026-10-22): an Expo module for Google ML Kit text recognition with the bundled Latin model, so it reads on the phone with no model download (ML Kit's usage metrics: see "OCR for the pillar sign"). On iOS its config plugin, as added, uses Apple Vision instead of ML Kit; set `["expo-mlkit-ocr", { "iosEngine": "mlkit" }]` if the iPhone build should use ML Kit |
| Zone colour | `react-native-image-colors` 2.6 (added 2026-10-23; an Expo module using Android's Palette, on the phone, no network). Native code, so the phone needs a fresh `npx expo run:android` |
| Notifications | `expo-notifications` (chosen 2026-10-22 over Notifee, see "Notifications") |
| Share spot | React Native's built-in `Share` for the message, `expo-sharing` for a photo (2026-10-22: no extra library; text and image are not sent together) |
| Charts | `react-native-gifted-charts` with `react-native-svg` and its peer dependency `expo-linear-gradient` (both added at M6, 2026-10-22; native code, so the phone needs a fresh `npx expo run:android`) |
| Location | `expo-location` (2026-10-23): foreground only, with background location and the foreground service off in `app.json`; Android's geocoder names a new place. Native config, so the phone needs a fresh `npx expo run:android` |
| Export database | `expo-sharing` |
| Laptop DB view | Android Studio Database Inspector (see below) |
| Tests | Jest, starting with the fee calculator test cases |

## Before you start: install from zero

Written for a Windows laptop, with macOS differences noted. Check each download page for the current version when you install.

**Laptop requirements:** 16 GB RAM is comfortable (8 GB works if you test on your real phone and skip the emulator). Keep about 20 GB free disk for Android Studio, the Android SDK and build caches. The first Android build downloads a lot and can take 10 to 20 minutes; later builds are much faster.

### 1. Laptop software

| # | Install | Where | Why | Check it worked |
|---|---|---|---|---|
| 1 | Node.js (LTS version) | nodejs.org | Runs Expo and React Native tooling; includes `npm` and `npx` | `node -v` and `npm -v` |
| 2 | Git | git-scm.com (on Windows this also gives you Git Bash) | Version control; Claude Code on Windows also uses Git Bash | `git --version` |
| 3 | Android Studio | developer.android.com/studio | Android SDK, `adb`, the Java JDK it bundles, Database Inspector | Opens without errors |
| 4 | VS Code | code.visualstudio.com | Code editor | Opens |
| 5 | Claude Code | Official install page (docs.claude.com, Claude Code section) | Builds the app with you | `claude --version` |
| 6 | DBeaver Community | dbeaver.io | Open the app's SQLite file on the laptop (works for Oracle too) | Opens |

Optional:
- **DB Browser for SQLite** (sqlitebrowser.org): lighter than DBeaver for a quick look.
- **scrcpy** (github.com/Genymobile/scrcpy): shows and controls your phone screen on the laptop. Handy for testing and screenshots.
- **VS Code extensions:** Expo Tools, ESLint, Prettier.
- **EAS CLI** (`npm install -g eas-cli`): only if you want Expo's cloud builds instead of building on your laptop.

### 2. Android Studio setup

1. Run the setup wizard and choose **Standard**. It installs the Android SDK, SDK Platform-Tools (`adb`) and the emulator.
2. Open **Settings → Languages & Frameworks → Android SDK**:
   - **SDK Platforms:** tick the latest Android version.
   - **SDK Tools:** tick Android SDK Build-Tools, Android SDK Command-line Tools (latest) and Android SDK Platform-Tools.
   - Pixel phone on Windows: also tick **Google USB Driver**. Other brands (Samsung, Xiaomi, Oppo) may need the brand's own USB driver from their website if `adb devices` shows nothing.
3. Set environment variables, then open a new terminal.

   Windows (System Properties → Environment Variables → User variables):
   - `ANDROID_HOME` = `%LOCALAPPDATA%\Android\Sdk`
   - `JAVA_HOME` = `C:\Program Files\Android\Android Studio\jbr`
   - Add to `Path`: `%ANDROID_HOME%\platform-tools`

   macOS (add to `~/.zprofile`):
   ```bash
   export ANDROID_HOME=$HOME/Library/Android/sdk
   export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
   export PATH=$PATH:$ANDROID_HOME/platform-tools
   ```
4. Check: `adb version` and `java -version` both print a version.

### 3. Phone setup (Android)

1. **Developer options:** Settings → About phone → tap **Build number** 7 times. On Xiaomi tap **OS version** (or **MIUI version**) instead.
2. **USB debugging:** Settings → Developer options → turn on **USB debugging**.
   - Xiaomi also needs **Install via USB** and **USB debugging (Security settings)** on. These ask for a Mi account and a SIM card.
3. Use a USB cable that carries data. Some cables only charge.
4. Plug in the phone, unlock it, and tap **Allow** on the "Allow USB debugging?" prompt (tick "Always allow from this computer").
5. Check on the laptop: `adb devices` lists your phone with the word `device`. If it says `unauthorized`, look for the prompt on the phone again.
6. Optional, Android 11+: **Wireless debugging** in Developer options, then `adb pair` so you can test without the cable.
7. Make sure Google Maps is installed (needed for "Open in Google Maps").

You do not need the Expo Go app. OCR needs a development build, which `npx expo run:android` installs on the phone for you.

### 4. Accounts

| Account | Needed? | Cost |
|---|---|---|
| Claude (your personal account, not a work one) | Yes, for Claude Code | Paid plan or API credit |
| GitHub | Recommended, to back up the code | Free |
| Expo | Only for EAS cloud builds | Free tier |
| Google Play Developer | Only to publish on the Play Store. Sharing an APK with friends does not need it | USD 25 one-time |
| Apple Developer | Only when you build for iPhone | USD 99 per year |

### 5. Test the whole toolchain before the real project

Build an empty app first. If this works, everything is installed correctly:

```bash
npx create-expo-app@latest hello-test --template blank
cd hello-test
npx expo run:android
```

The app should open on your phone showing "Open up App.js to start working on your app!". Delete `hello-test` afterwards.

Common failures:
- `SDK location not found` or `adb not recognized`: `ANDROID_HOME` or `Path` is wrong, or the terminal was opened before you set them.
- `No Android connected device found`: run `adb devices` and fix the phone connection (step 3).
- `JAVA_HOME is not set` or a Java version error: point `JAVA_HOME` at Android Studio's `jbr` folder.

## Create the project (M0)

```bash
npx create-expo-app@latest park-yourself --template blank   # "blank" is the JavaScript template
cd park-yourself
npx expo install expo-router expo-dev-client expo-sqlite expo-crypto expo-camera expo-image-manipulator \
  expo-file-system expo-notifications expo-location expo-sharing react-native-svg
npx expo run:android        # builds the dev app and installs it on the USB-connected phone
```

`react-native-gifted-charts` and `expo-linear-gradient` were added at M6, and `expo-mlkit-ocr` at M4 (2026-10-22), and `expo-image-picker` for photos from the gallery (2026-10-22). M5 needs no extra library. A native library added later needs a fresh `npx expo run:android`.

### M0 setup notes (2026-10-20)

What was actually set up, and why it differs from the steps above:

- **Versions:** Expo SDK 58 (React Native 0.88, React 19.3), created with `--template blank@sdk-58`. The project root is `Desktop\Park Yourself`; `create-expo-app` rejects spaces, so it was created as `park-yourself` and moved in.
- **Android package:** `com.parkyourself.app` (in `app.json`). Decide before real use: changing it later installs a separate app that cannot see the old database.
- **Folders:** screens in `src/app/` (Expo Router), data layer in `src/db/`, config plugins in `plugins/`.
- **Java:** `JAVA_HOME` points at Android Studio's JDK 21. The Oracle Java 25 on `PATH` is too new for Gradle.
- **Windows long paths:** React Native's C++ builds nest the project path twice and break Ninja 1.10's 260-character limit (`ninja: error: mkdir`). Fix: CMake 3.31.6 from SDK Manager (ships Ninja 1.12) plus `plugins/withCmakeVersion.js`, which writes `cmake.dir` into `android/local.properties` on every prebuild. Needed on any Windows machine that builds this project.
- **Foreign keys in transactions:** `withExclusiveTransactionAsync` opens a second connection where `PRAGMA foreign_keys` was never run. SQLite is therefore compiled with `-DSQLITE_DEFAULT_FOREIGN_KEYS=1` (expo-sqlite plugin options in `app.json`). Use `inTransaction()` from `src/db/core.js` for multi-step writes, and run every query inside it through `txn`.
- **`react-dom` pinned to 19.3.0:** Expo Router's web tabs pull in `react-dom`, whose newest version wants a newer `react` than SDK 58 ships.
- **SDK 58 changes for later milestones:** `File.write()` is now async (`writeSync()` for the old behaviour); foreground notifications show by default unless `setNotificationHandler` says otherwise (M3).
- **Laptop DB copy:** `npm run db:pull` copies the database and its `-wal` file into `db-snapshot/`. Use it instead of `adb exec-out ... > file` in Windows PowerShell, which corrupts binary output.
- **Self-test:** in development builds the M0 screen runs `src/db/selfTest.js` against a throwaway database and shows PASS/FAIL for each data layer rule.

## Checking the database from your laptop

SQLite works with database GUIs like Toad or phpMyAdmin. The catch is that the database file lives inside the app's private storage on the phone, so you need one of these ways to reach it:

| Option | How | Live? | Works on release build? |
|---|---|---|---|
| Android Studio Database Inspector | Phone on USB → App Inspection → Database Inspector. Run SQL against the live DB | Yes | No, debuggable builds only |
| `adb` pull + desktop GUI | `adb exec-out run-as <package> cat files/SQLite/park-yourself.db > park-yourself.db`, then open in DBeaver or DB Browser for SQLite | No, snapshot | No, debuggable builds only |
| In-app export | Settings → Export database → share to Google Drive or email → open on laptop | No, snapshot | Yes |

Notes:
- Database Inspector is the closest to a live Toad session: table browser plus a query tab, while the phone is on USB.
- DBeaver opens SQLite and Oracle, so it is the closest to Toad for a pulled or exported copy. DB Browser for SQLite is lighter.
- Optional: a hidden Debug screen in the app that runs a SELECT you type and shows the rows, for checks without a laptop.
- Check the real file path first with `adb shell run-as <package> ls -R files`.
- SQLite in WAL mode keeps recent writes in a `-wal` file. Before copying, run `PRAGMA wal_checkpoint(TRUNCATE);` in the app, or copy the `-wal` file too, otherwise the copy can miss recent changes.

## Milestones

Version 1 is finished when M0 to M8 are done.

- [x] **M0 Setup**: Expo project (JavaScript), dev build running on the phone, SQLite with the `user_version` migration list and `foreign_keys` on, `db/` data layer following the data layer rules (UUIDs, `updated_at`, soft delete), tables visible in Android Studio Database Inspector
- [x] **M1 Vehicles, park and find (manual)**: first-run vehicle setup, Vehicles screen, bottom tab bar, Home (one vehicle at a time with the round Park button), Park screen with photo, level/bay typed by hand, note; Find screen with the way back (access type and first shop, added while parked) and reverse route; Found my car; History with delete
  - 2026-10-22: pillar photos built (several per session, Add photo on Find while parked, full-screen view, delete one); to check on the phone after `npx expo run:android`. Renaming a car (Cars → pencil → Rename car) built the same day.
  - 2026-10-22: redesign after first use on the phone: Park's optional parts folded (rate, timer, note), the way back moved to Find, photos from the gallery, History in months with totals and place-first cards; to check on the phone after `npx expo run:android` (`expo-image-picker` is native).
- [x] **M2 Places, rates and fees**: place picker with search and recent places, weekday and weekend rates saved per place, optional fixed public holiday amount, update-rate prompt, public holiday list (the toggle on Park was removed 2026-10-23), overnight stays shown as Estimate, amount paid, Jest tests for every row of the fee test table
  - 2026-10-22: built with Jest tests; to check on the phone.
- [x] **M3 Notifications**: ongoing notification per parked vehicle with Navigate and Extend timer, timer reminders, permission prompts, tested with the screen locked
  - 2026-10-22: built with `expo-notifications`: the ongoing notification (start time and timer end, no fee), Navigate and Extend timer (both open the app), reminders before and at the end, the permission asked when Find first opens after parking, the reminder lead time in Settings. To check on the phone after `npx expo run:android`, including with the screen locked.
- [x] **M4 OCR and zone colour**: pillar photo → level and bay chips, raw OCR text saved; colour suggestion, colour chips, Jest tests for the hex-to-name table (tap-to-pick dropped 2026-10-23)
  - 2026-10-22: dependencies approved: an ML Kit OCR wrapper and `react-native-image-colors`.
  - 2026-10-22: OCR built with `expo-mlkit-ocr`: the first photo is read (the next only if it gave nothing), level and bay chips fill the fields, the raw text is saved with the photo. Colour suggestion and tap-to-pick are not built yet.
  - 2026-10-23: the parser ranks by text size and drops plates, phone numbers and ads; the likeliest level and bay fill the empty fields; the zone colour is suggested from a colour word on the sign, else from the paint around the code (`react-native-image-colors`), and its hex is saved. Checked on the phone. Tap-to-pick dropped: the colour fills in from the sign.
- [x] **M5 Share spot**: share the parking info as a message, or a photo, through the share sheet (QR code dropped 2026-10-22)
  - 2026-10-22: built without an extra library: Share on Find (message), share in the photo view (photo).
- [x] **M6 Monthly spending**: Spending screen, breakdown by place and vehicle, 12-month chart, tap through to sessions
  - 2026-10-22: built with Jest tests; to check on the phone after `npx expo run:android` (the chart has native code).
- [x] **M7 Location**: permission asked only from Allow location, one reading when Park opens, the place filled in (a saved place near you, else a name from Android's geocoder), the location saved with the session and on a place's first visit, Open in Google Maps with walking directions on Find, map link in the share message
  - 2026-10-22: on hold while the GPS design is rethought.
  - 2026-10-22: online place search is to be designed with it (see "Decisions made", Place search).
  - 2026-10-23: redesigned and built (see "Location"), and checked on the phone.
- [ ] **M8 Polish**: Settings, export database, app icon, animations, a loading animation. Dark mode was built early (2026-10-22); what is left is making system dialogs and the launch screen follow it
  - 2026-10-24 (decided by the user): M8 is finished before version 2 continues past C0. The signed release APK moves out of M8: it is built once version 2 is ready (C9). Added to M8:
    - **Animations** with `react-native-reanimated` (and `react-native-worklets`), everywhere they help: Home (Park button spring, the car driving in with a glow pulse when parked and driving off on Found my car, status and spot fading in), folding rows and chips (Disclosure opens and closes smoothly with the chevron turning, a small pop on a picked chip, More options sliding), lists and Spending (cards fading up in turn, bars growing, the total counting up) and moments (a check mark when Park saves, a small celebration on Found my car, level and bay chips popping in as OCR reads them). Every animation is short and is skipped when the phone's Reduce motion setting is on.
    - **Loading animation**: Android draws the first frame itself (a still icon on charcoal). Then, on a cold start only, a cute car drives in and reverses into a bay while the P sign lights up emerald, for about 1 second, then fades into Home. A tap skips it; not shown when returning from another app.
    - **App icon**: designed from the app's look (an emerald P parking sign with the car, on charcoal), approved by the user before it goes in; the same drawing is used for the launch screen.
  - 2026-10-24: the icon was approved for now; the user wants a better one later. The launch screen (`expo-splash-screen`, approved) is charcoal with the icon's sign and car in both phone modes, so it flows into the loading animation. Built: the animations, the loading animation, dark system dialogs, the icon and the launch screen; to check on the phone after `npx expo run:android`.
  - 2026-10-22: Settings (Places, Public holidays, Extend timer by) and Export database are built; to check on the phone. App icon, signed APK and the dark system dialogs are still to do.

- [ ] **M9 Camera-first Park** (added 2026-10-24, before version 2 continues): Park opens on the camera with Skip photo; Save pinned at the bottom; the timer (Timer when parking) and the location (Use location when parking) set in Settings instead of on each park; Stop timer on Find. See "User flow", Parking

- [ ] **M10 Timer wheel** (added 2026-10-24): timer lengths are picked on a scrolling hours-and-minutes wheel, like setting an alarm, instead of fixed chips. Built in the app (React Native and Reanimated, no new library), in the app's look. Settings: **Timer when parking** is a wheel (0 h 00 m is Off; 5-minute steps). Find: **Set timer** opens the same wheel in a sheet to set this park's timer exactly, showing when it would end; Extend and Stop stay
- [ ] **M11 Car park list** (added 2026-10-24): a built-in list of about 30 major Klang Valley mall car parks with their public car rates, researched from the web (mall and operator sites) by Claude, each with its GPS point, source link, the date it was checked and, when the source says, the date the rates took effect. Shipped inside the app: the app itself makes no network call for it (AGENTS.md, "Privacy"). With the location on, a listed car park near you is suggested before Android's geocoder is asked; place search also finds listed car parks. Picking one makes it your place with its rates filled in, marked "From the car park list, checked <date>: check the sign"; your own saved rates always win. Updated in later app updates, or moved to the version 2 server (C7)

  - 2026-10-24 (decided by the user, after M11 was built): the list moves to Supabase, so rates can change without a new app build:
    - **Source of truth:** `src/carparks/carParkList.json` in git. `npm run carparks:sql` turns it into a Supabase migration (`supabase/migrations/`), pushed like any other (local, then dev). Rates are never edited in the dashboard.
    - **Rate history:** a rate row has `effective_from` (a date, or null for "since before it was first checked"). A change adds rows with the new date and keeps the old ones; the app uses, per day type, the latest rate in effect today. A change can be added before it starts.
    - **Server:** the dev project (Tokyo) for now, the release build included (its env file, `.env.production.local`, points there). Tables `car_park` and `car_park_rate` anyone may read (the `anon` role, like C0's test table); only migrations write.
    - **Download:** automatically, at most once a day when the app opens (a privacy exception chosen by the user: AGENTS.md, "Privacy"). A downloaded list replaces the phone's copy; the built-in JSON is used only until a download has worked (first open, offline, a server that is paused or reset). Errors never reach the user's screens; Database check shows the last one.
- [ ] **M12 Car park list on Supabase** (added 2026-10-24): the server tables and data migration, rate history on the phone (SQLite v3), the daily download, and the list's source in one JSON file. See M11's notes above

## Version 2: Park Yourself Cloud (future)

Not part of version 1; start after M8 and M9 (C0, the environments, was set up early on 2026-10-24). You will write the sync yourself, to learn how syncing and data migration work.

### Decisions

| Topic | Decision |
|---|---|
| Local-first | SQLite on the phone stays the main database. Every screen reads and writes SQLite. The app keeps working fully offline (basement car parks often have no signal) and without an account |
| Cloud | Supabase: Auth, PostgreSQL with Row Level Security, Realtime, Edge Functions. No Supabase Storage |
| Sync | Hand-written, no sync library: push local changes, pull server changes, last write wins |
| Photos | Stay on the phone. Never uploaded. The text details (level, bay, zone colour, route, note) sync |
| Sign-in | Optional |

### What syncs

| Table | Syncs? | Why |
|---|---|---|
| `vehicle`, `place`, `place_rate`, `public_holiday`, `parking_session` | Yes | Your data, needed on other phones and for sharing |
| `photo` | No | Photos stay on the phone; file paths only mean something on that phone |
| `setting` | No | Preferences for one phone |
| `car_park`, `car_park_rate` | Downloaded, never uploaded | The public car park list (M12): Supabase holds it, the phone keeps a copy and never sends its own |

### Architecture

```
Phone (Expo app)                              Cloud (Supabase)
┌──────────────────────┐   HTTPS      ┌───────────────────────────────┐
│ SQLite (main copy)    │ ◄─────────► │ Auth (email link, Google)      │
│ Photos (files)        │  push/pull  │ PostgreSQL + Row Level Security│
│ Sync code (db/sync)   │ ◄─ realtime │ Realtime (shared car updates)  │
└──────────────────────┘             │ Edge Functions (push, invites) │
        ▲                             └───────────────┬───────────────┘
        │ push notification (FCM)                     │
        └─────────────── Expo Push Service ◄──────────┘
Web: share-link fallback page + optional dashboard (Next.js)
```

### Features

- **Accounts:** Supabase Auth with email magic link and Google sign-in. First sign-in uploads everything already on the phone. Account deletion in the app and on a web page (Google Play requires both for apps with accounts). A `profile` table with display name.
- **Backup and sync across phones:** everything except photos. For moving to a new phone, **Export photos** in Settings saves a zip to your own Google Drive or Files.
- **Family sharing:** create a family group; invite by link or QR (single-use token that expires); share a car with the group (per-car switch). Members see that car's active session live through Supabase Realtime: place, level, bay, zone colour, route and note, but no photo. A **Send photo** button shares the photo phone to phone through WhatsApp. Optional push notification when a shared car is parked. Leave group and remove member revoke access immediately.
- **Shared rates in your friend group:** when you type a place name, "2 friends saved rates for Pavilion Bukit Jalil. Use them?". Name matching with PostgreSQL `pg_trgm` similarity ("Pavilion BJ" matches "Pavilion Bukit Jalil"), plus GPS distance when both have a location. Each rate stores who submitted it and when; a "still correct?" button lets friends confirm it. Your own saved rate always wins. A public community is out of scope (it needs moderation).
- **Share links:** `https://<your-domain>/s/<code>`. App installed: opens the app and imports the spot (Android App Links need `assetlinks.json` on your domain). App not installed: a small web page with the text details. Links expire (for example after 24 hours).
- **Push notifications:** Expo Push Service, which uses Firebase Cloud Messaging on Android (needs a Firebase project and its credentials in the Expo config). Device tokens stored after sign-in; an Edge Function sends on database changes. Timer reminders stay local so they work offline.
- **Web dashboard (optional):** Next.js pages for history, spending and rates. Supabase's own Table Editor and SQL Editor already let you see and edit the data from your laptop.

### How the sync works (to build yourself)

1. **Change tracking.** A version 2 migration adds a local `dirty` column to every synced table, with `DEFAULT 1` so every existing row is pushed on the first sync. The data layer sets `dirty = 1` on every insert, update and soft delete.
2. **Server columns.** Each server table has the same columns plus `owner_id` and `server_updated_at`, which a database trigger sets to `now()` on every write. The server's clock decides sync order, so a phone with a wrong clock cannot break it.
3. **Push.** Read rows with `dirty = 1`, parents first (`vehicle`, `place`, then `place_rate`, `public_holiday`, `parking_session`). Send them in batches to an upsert function. The server keeps whichever version has the newer `updated_at` (last write wins). After a successful push, set `dirty = 0` only if the row's `updated_at` has not changed since you read it, so an edit made during the push is not lost.
4. **Pull.** Ask for rows with `server_updated_at` later than `last_pulled_at` (saved in `setting`). Write them into SQLite unless the local row is dirty and newer. Save the largest `server_updated_at` received as the new `last_pulled_at`.
5. **Order and timing.** Push, then pull. Run on app open, after each save, on pull-to-refresh, and occasionally in the background.
6. **Deletes.** Soft-deleted rows sync like any other change. Purge them on both sides once they are older than an agreed window (for example 90 days).
7. **First sign-in.** All local rows are dirty, so they are pushed; then pull brings rows from your other phones.
8. **Duplicate places.** Two phones offline can both create "Pavilion Bukit Jalil" with different UUIDs. The server's unique name rule rejects the second. Merge rule: keep the older place, point the other one's rates and sessions at it, and soft-delete the duplicate.

**Type mapping**

| SQLite | PostgreSQL |
|---|---|
| `TEXT` UUID id | `uuid` |
| `INTEGER` epoch ms | `bigint` (or `timestamptz`, converted in the sync code) |
| `INTEGER` 0/1 flags | `boolean` |
| `REAL` | `double precision` |
| `TEXT` JSON (`rate_snapshot`) | `jsonb` |

### Changing the schema in two databases (migration checklist)

1. Write the PostgreSQL migration with the Supabase CLI (`supabase migration new`), including the `GRANT`s for every new table (see "Security and privacy"). Check it on local (`supabase db reset`, then `supabase test db`), then push it to hosted dev with `supabase db push --linked --dry-run`, then without `--dry-run`. Always pass `--linked`: from the next major CLI version, `db push` without it targets local.
2. Add the matching step to the SQLite `MIGRATIONS` list.
3. Make changes additive first (new nullable column or a default), because phones still running the old app keep syncing and must not break.
4. Backfill existing data in the migration where needed.
5. Release the app. Remove an old column only after every phone has updated.
6. Test by upgrading a phone that has real data from the previous version.

### Security and privacy

- Only the Supabase publishable key (`sb_publishable_...`, formerly the anon key) goes in the app. The secret key (`sb_secret_...`, formerly the service-role key) bypasses RLS: it lives only in Edge Functions and is never committed or pasted anywhere. The local stack's keys are fixed defaults, the same on every laptop, so they are not secrets; the hosted projects' keys are.
- A Row Level Security policy on every table, each with a test: user A must not read user B's data.
- Every new table in `public` gets explicit `GRANT`s to `authenticated` in the migration that creates it. Supabase no longer exposes new tables to the Data API by default (new projects since 2026-05-30, every project from 2026-10-30), and a missing grant fails before RLS runs, on local `db reset` too. Grant only what the app uses; `anon` gets nothing (two exceptions: C0's `connection_check`, dropped at the start of C1, and M12's public car park list, read only).
- Car location is personal data: a privacy policy is required on Google Play for apps with accounts and location, and Malaysia's PDPA applies once friends' data is stored.
- Data export and account deletion.

### Environments (chosen 2026-10-24)

Three environments, so both local Docker and the hosted service get learned. Schema changes only move one way: migration file → local → hosted dev → hosted prod.

| | Local (Docker) | Hosted dev | Hosted prod (C9) |
|---|---|---|---|
| Runs on | The laptop: Docker Desktop (WSL 2) and `supabase start` | Supabase free tier, Tokyo region (created 2026-10-24; fine for test data) | Supabase free tier, Singapore region (closest to Malaysia; real data stays in the region) |
| Used for | Writing migrations, policy tests, quick resets | Phone tests over mobile data, real sign-in emails, two-phone sync tests | Real data, friends |
| Data | Throwaway, rebuilt by `supabase db reset` from `supabase/seed.sql` | Test data only | Real |
| Free-tier cost | None (does not count as a project) | Project 1 of 2 | Project 2 of 2 |

- **`supabase/` lives in this repo** (config, migrations, seed, pgTAP tests), next to `src/db/migrations.js`.
- **Never change a hosted database in its dashboard** without bringing the change back as a migration file (`supabase db diff` or `supabase db pull`). It is the cloud version of "never edit a migration step that has already run".
- **The app picks its backend from one env file:** `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.development.local` (git-ignored, copied from `.env.example`), with a local block and a hosted dev block; keep one uncommented. Expo loads that file only in development builds. Release builds read `.env.production.local` instead (also git-ignored): since M12 it points at hosted dev, for the daily car park list download, until C9 adds the prod project. Not `.env.local`: Expo loads it in every build.
- **The phone cannot reach `127.0.0.1` on the laptop.** Over USB, `adb reverse tcp:54321 tcp:54321`; over Wi-Fi, the laptop's LAN IP.
- **Sign-in emails on local** land in the inbox the local stack runs, not a real mailbox.
- **A free hosted project pauses after 7 days idle**; restore it from the dashboard.

### Running it

| Item | Detail |
|---|---|
| Environments | Local (Docker), hosted `dev` and hosted `prod`; see "Environments" |
| Migrations | Supabase CLI, versioned in git in `supabase/migrations/`, checked on local, then pushed to dev, then prod |
| Error tracking | Sentry for the app and Edge Functions |
| App updates | EAS Update for JavaScript-only fixes; a new build when native libraries change |
| Domain | Needed for share links and App Links (about RM 50 per year) |
| Cost | Free tier is enough for you and friends (no storage used). A free project pauses after a period of inactivity; check current limits |
| Distribution | Google Play internal testing (USD 25 developer account) or keep sharing the APK |

### Testing

- Two phones on one account: edit offline on both, reconnect, check the result.
- Delete on one phone, check it disappears on the other.
- Create the same place name offline on two phones, check the merge.
- Run an old app version against the migrated server.
- Policy tests with two users for every table (pgTAP, `supabase test db`, run on local).
- CI (2026-10-25): every push and pull request applies all migrations to an empty Postgres and runs the pgTAP tests (the "Supabase migrations" job), and a pull request that edits, renames or deletes an existing migration fails. Pushing to a hosted project stays manual.
- Family sharing: invite, accept, live update, remove member, access stops.
- Share links: app installed, not installed, expired.

### Milestones

- [ ] **C0** Environments, no tables yet: Docker Desktop and the Supabase CLI installed; `supabase init` and `supabase start` working; hosted dev project created and linked; one trivial migration pushed to local and dev; one pgTAP test passing with `supabase test db`; the dev build reading one row from local (through `adb reverse`) and from hosted dev
  - 2026-10-24: Docker Desktop and the CLI installed; local stack running with storage and analytics off; hosted dev project (Tokyo) linked; migration `connection_check` (one row anon may read, dropped at the start of C1) pushed to local and dev; pgTAP test passing (5 of 5); Check connection on the Database check screen built. To check on the phone, against local and hosted dev.
- [ ] **C1** Drop C0's `connection_check` (a new migration) and remove `readConnectionCheck` and the Check connection card; PostgreSQL schema matching v1 plus `owner_id` and `server_updated_at`, policies and policy tests
- [ ] **C2** Sign-in, profile, account deletion
- [ ] **C3** SQLite migration adding `dirty`; push
- [ ] **C4** Pull, `last_pulled_at`, conflict handling, duplicate-place merge, two-phone tests
- [ ] **C5** Family groups, invites, shared car with live updates, Send photo
- [ ] **C6** Push notifications for shared-car events
- [ ] **C7** Shared rates in the friend group, name matching, confirmations
- [ ] **C8** Share links with the web fallback page and App Links
- [ ] **C9** Optional web dashboard, privacy policy, data export, prod project, Play internal testing

### Decide later

- Sign-in methods: email link, Google, or both?
- Shared rates: friend group only, or public one day?
- Share link expiry time?
- How long to keep soft-deleted rows before purging?
- Monthly budget before leaving the free tier?
- Domain name?

## Later ideas (not planned yet)

- iPhone build
- Home-screen widget and quick-settings tile for one-tap Park
- Rates that change by time of day (for example a flat night rate)
- Per-car-park overnight rules (24 hours from entry, flat overnight charge, and so on) to replace the overnight estimate
- Auto-save when the phone disconnects from the car's Bluetooth (Android only)
- Share the app with friends as an APK
- Seed a list of car parks you use often, with their rates

## Open questions

### Answered (your notes, kept as you wrote them)

- App name: Park Yourself
- Default currency: RM
- Reminder lead time default (10 min):
- Extend timer default (30 min):
- How long to keep photos :Forever for now but have a delete button
- If a stay goes past 24 hours, does the daily cap apply per 24 hours: No, it will add the other day rate as well
- App language:ENG
- Car parks you use often, with their rates (to seed presets): not for now
- Stays over midnight: rarely park overnight, and every car park has its own rules (so the app shows an estimate and you confirm the amount paid)
- Public holidays: weekend rate, with an option to enter a fixed amount; if not chosen, default is weekend
- Vehicle type: one car is enough
- Plate number: not needed

### Still open

- **Grace period.** Applies to the whole stay only (current assumption)?
- Anything else:
