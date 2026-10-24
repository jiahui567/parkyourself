import data from './carParkList.json';

// The car park list (PLAN.md, M11 and M12): public car rates of major Klang
// Valley mall car parks, researched on the web by Claude.
//
// carParkList.json is the one source. `npm run carparks:sql` turns it into a
// Supabase migration, and the app downloads the list from Supabase once a day;
// this built-in copy is used only until a download has worked (first open,
// offline, a paused or reset server). Change version with every edit.
//
// Each car park: id (a stable slug), name, area (with a former name, which
// search also finds), lat and lng (or null), source_url (where the rates came
// from), checked_on (YYYY-MM-DD the source was read), notes (what the rates
// leave out, shown on Park), and rates: rows in the place_rate shape (money in
// sen) with day_type and effective_from (YYYY-MM-DD the rate took effect, or
// null for "since before it was first checked"). A rate change adds rows with
// a later effective_from and keeps the old ones. A holiday rate can only be a
// flat amount; with none, public holidays use the weekend rate.
export const CAR_PARK_LIST = data;
