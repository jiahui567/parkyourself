// The longest text each synced column takes, in characters (decided by the
// user on 2026-10-30): names 100, notes 500, codes 20. src/db/core.js refuses
// longer text and the fields that type it stop there (maxLength). The server
// checks the same lengths (supabase/migrations/*_synced_text_limits.sql): a
// stricter server would refuse rows the phone took (PLAN.md, C1), so a change
// here needs a migration there, which test/serverLimits.test.js checks, and
// lowering a limit also cuts the text already saved, on both sides (SQLite
// step v8 did it for these). The rate snapshot is its JSON text, which only
// the app writes.
export const MAX_LENGTH = {
  vehicle: { name: 100, colour: 100 },
  place: { name: 100, note: 500 },
  public_holiday: { name: 100 },
  parking_session: { level: 20, bay: 20, zone_colour_name: 100, landmark: 100, note: 500, rate_snapshot: 4096 },
};

// The length of text as the limits count it: characters (code points), as
// SQLite's length() and PostgreSQL's char_length() count them, not
// JavaScript's UTF-16 units (an emoji is one character, two units). A field's
// maxLength counts units, so it never lets through more than a limit.
export const characterCount = (text) => [...text].length;
