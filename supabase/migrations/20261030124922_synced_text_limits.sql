-- 2026-10-30 (decided by the user): the longest text the synced tables take,
-- in characters, the same as the phone's (MAX_LENGTH in
-- src/lib/textLimits.js; test/serverLimits.test.js compares the two): names
-- 100, notes 500, level and bay 20, the first shop 100. Without them one
-- account could fill the database for everyone. A pushed row over a limit is
-- refused alone (23514, the constraint's name), like any broken rule.
--
-- The rate snapshot is checked as the server prints it, which spaces out the
-- phone's JSON, so it may be twice the phone's 4096; the zone colour is the
-- '#RRGGBB' the phone checks since 2026-10-23.
--
-- Rows already here are first cut to the limits with the expressions of the
-- phone's SQLite step v8 (src/db/migrations.js), so both sides end with the
-- same text and every row meets the checks: a check tests a whole row at
-- every write, and an older row over a limit would be refused at every push.
-- Text is cut and its trailing spaces trimmed; a car or place name becomes
-- its first 91 characters, a space and the first 8 characters of its id, so
-- two names the app cut never become one. updated_at + 1, once per row,
-- takes a cut row to the phones without beating a newer change. This goes
-- out before any phone runs step v8: until these checks exist, an older app
-- could still save longer text that such a phone would pull and never cut. The CLI runs this file as one
-- transaction: a longer row pushed (by an older app) between a cut and its
-- check fails the check, and everything is undone, to be pushed again. Never
-- edit this file once it has been pushed.

update public.vehicle set
  name = case when char_length(name) > 100 then rtrim(left(name, 91)) || ' ' || left(id::text, 8) else name end,
  colour = case when char_length(colour) > 100 then rtrim(left(colour, 100)) else colour end,
  updated_at = updated_at + 1
where char_length(name) > 100 or char_length(colour) > 100;

-- Place by place: a cut name can still be another place's of the same
-- account (an account can choose its ids and names), which the unique index
-- refuses, and one such place must not stop the migration for everyone. That
-- place keeps its name and only its note is cut, as the phone's OR IGNORE
-- skips it; place_name_length below is therefore not valid, so the rows left
-- are not checked, while every later write is.
do $$
declare
  v_place record;
begin
  for v_place in
    select id, owner_id from public.place where char_length(name) > 100 or char_length(note) > 500
  loop
    begin
      update public.place set
        name = case when char_length(name) > 100 then rtrim(left(name, 91)) || ' ' || left(id::text, 8) else name end,
        note = case when char_length(note) > 500 then rtrim(left(note, 500)) else note end,
        updated_at = updated_at + 1
      where id = v_place.id and owner_id = v_place.owner_id;
    exception
      when unique_violation then
        update public.place set
          note = rtrim(left(note, 500)),
          updated_at = updated_at + 1
        where id = v_place.id and owner_id = v_place.owner_id and char_length(note) > 500;
        raise notice 'Place % keeps its name: cut, it would be another place''s.', v_place.id;
    end;
  end loop;
end
$$;

update public.public_holiday set
  name = rtrim(left(name, 100)),
  updated_at = updated_at + 1
where char_length(name) > 100;

update public.parking_session set
  level = case when char_length(level) > 20 then rtrim(left(level, 20)) else level end,
  bay = case when char_length(bay) > 20 then rtrim(left(bay, 20)) else bay end,
  zone_colour_name = case when char_length(zone_colour_name) > 100 then rtrim(left(zone_colour_name, 100)) else zone_colour_name end,
  landmark = case when char_length(landmark) > 100 then rtrim(left(landmark, 100)) else landmark end,
  note = case when char_length(note) > 500 then rtrim(left(note, 500)) else note end,
  zone_colour_hex = case when zone_colour_hex ~ '^#[0-9A-Fa-f]{6}$' then zone_colour_hex end,
  -- Only a caller that is not the app can make one this large.
  rate_snapshot = case when octet_length(rate_snapshot::text) <= 8192 then rate_snapshot end,
  updated_at = updated_at + 1
where char_length(level) > 20 or char_length(bay) > 20 or char_length(zone_colour_name) > 100
  or char_length(landmark) > 100 or char_length(note) > 500
  or zone_colour_hex !~ '^#[0-9A-Fa-f]{6}$' or octet_length(rate_snapshot::text) > 8192;

alter table public.vehicle
  add constraint vehicle_name_length check (char_length(name) <= 100),
  add constraint vehicle_colour_length check (char_length(colour) <= 100);

alter table public.place
  add constraint place_name_length check (char_length(name) <= 100) not valid,
  add constraint place_note_length check (char_length(note) <= 500);

alter table public.public_holiday
  add constraint public_holiday_name_length check (char_length(name) <= 100);

alter table public.parking_session
  add constraint parking_session_level_length check (char_length(level) <= 20),
  add constraint parking_session_bay_length check (char_length(bay) <= 20),
  add constraint parking_session_zone_colour_name_length check (char_length(zone_colour_name) <= 100),
  add constraint parking_session_landmark_length check (char_length(landmark) <= 100),
  add constraint parking_session_note_length check (char_length(note) <= 500),
  add constraint parking_session_zone_colour_hex_format check (zone_colour_hex ~ '^#[0-9A-Fa-f]{6}$'),
  add constraint parking_session_rate_snapshot_size check (octet_length(rate_snapshot::text) <= 8192);
