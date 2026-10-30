begin;
select plan(42);

select function_privs_are('public', 'push_synced_rows', array['text', 'jsonb'], 'anon', array[]::text[],
  'anon cannot push');
select function_privs_are('public', 'push_synced_rows', array['text', 'jsonb'], 'authenticated', array['EXECUTE'],
  'a signed-in user can push');

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.test'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.test');

-- As user A, the way src/cloud/sync.js calls: every column the phone has
-- except dirty, no owner_id.
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

select is(
  public.push_synced_rows('vehicle', '[{"id": "aaaaaaaa-0000-0000-0000-000000000001", "name": "My Myvi", "colour": null, "is_default": true, "archived": false, "created_at": 1792800000000, "updated_at": 1792800000000, "deleted_at": null}]'),
  '[]'::jsonb,
  'A pushes a car'
);
select is(
  (select owner_id from public.vehicle where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  '00000000-0000-0000-0000-00000000000a'::uuid,
  'the pushed car belongs to A'
);
select is((select is_default from public.vehicle), true, 'a boolean arrives as a boolean');

-- Last write wins, by the phone's updated_at.
select is(
  public.push_synced_rows('vehicle', '[{"id": "aaaaaaaa-0000-0000-0000-000000000001", "name": "Our Myvi", "colour": "Red", "is_default": true, "archived": false, "created_at": 1792800000000, "updated_at": 1792800060000, "deleted_at": null}]'),
  '[]'::jsonb,
  'A pushes a newer change'
);
select is((select name from public.vehicle), 'Our Myvi', 'a newer change replaces the server''s row');
select is(
  public.push_synced_rows('vehicle', '[{"id": "aaaaaaaa-0000-0000-0000-000000000001", "name": "Old name", "colour": "Red", "is_default": true, "archived": false, "created_at": 1792800000000, "updated_at": 1792800030000, "deleted_at": null}]'),
  '[]'::jsonb,
  'an older change is not refused'
);
select is((select name from public.vehicle), 'Our Myvi', 'but the server keeps its newer row');

-- A phone on an older app version leaves out a column it does not know.
select is(
  public.push_synced_rows('vehicle', '[{"id": "aaaaaaaa-0000-0000-0000-000000000001", "name": "Our Myvi", "is_default": true, "archived": true, "created_at": 1792800000000, "updated_at": 1792800090000, "deleted_at": null}]'),
  '[]'::jsonb,
  'a row without one of the columns is taken'
);
select is((select colour from public.vehicle), 'Red', 'and the column it left out keeps its value');
select is((select archived from public.vehicle), true, 'while the columns it sent change');

-- One refused row does not hold back the others in the same push.
select is(
  public.push_synced_rows('place', '[{"id": "aaaaaaaa-0000-0000-0000-000000000002", "name": "Mid Valley", "note": null, "lat": 3.1, "lng": 101.7, "last_used_at": null, "created_at": 1792800000000, "updated_at": 1792800000000, "deleted_at": null}]'),
  '[]'::jsonb,
  'A pushes a place'
);
select is(
  public.push_synced_rows('place', '[{"id": "aaaaaaaa-0000-0000-0000-000000000003", "name": "mid valley", "note": null, "lat": null, "lng": null, "last_used_at": null, "created_at": 1792800000000, "updated_at": 1792800010000, "deleted_at": null}, {"id": "aaaaaaaa-0000-0000-0000-000000000004", "name": "Sunway Pyramid", "note": null, "lat": null, "lng": null, "last_used_at": null, "created_at": 1792800000000, "updated_at": 1792800020000, "deleted_at": null}]'),
  '[{"id": "aaaaaaaa-0000-0000-0000-000000000003", "code": "23505", "constraint": "place_name_unique", "other": null}]'::jsonb,
  'a second place with the same name is refused, and says why'
);
select ok(
  not exists (select 1 from public.place where id = 'aaaaaaaa-0000-0000-0000-000000000003'),
  'the refused place is not on the server'
);
select ok(
  exists (select 1 from public.place where id = 'aaaaaaaa-0000-0000-0000-000000000004'),
  'the other place in the same push is'
);

-- Rows go in the order sent, so a rename that frees a name comes first.
select is(
  public.push_synced_rows('place', '[{"id": "aaaaaaaa-0000-0000-0000-000000000002", "name": "The Gardens", "note": null, "lat": 3.1, "lng": 101.7, "last_used_at": null, "created_at": 1792800000000, "updated_at": 1792800030000, "deleted_at": null}, {"id": "aaaaaaaa-0000-0000-0000-000000000003", "name": "mid valley", "note": null, "lat": null, "lng": null, "last_used_at": null, "created_at": 1792800000000, "updated_at": 1792800040000, "deleted_at": null}]'),
  '[]'::jsonb,
  'a name freed earlier in the same push can be taken'
);

-- A deletion syncs like any change.
select is(
  public.push_synced_rows('place', '[{"id": "aaaaaaaa-0000-0000-0000-000000000004", "name": "Sunway Pyramid", "note": null, "lat": null, "lng": null, "last_used_at": null, "created_at": 1792800000000, "updated_at": 1792800050000, "deleted_at": 1792800050000}]'),
  '[]'::jsonb,
  'A pushes a deleted place'
);
select is(
  (select deleted_at from public.place where id = 'aaaaaaaa-0000-0000-0000-000000000004'),
  1792800050000::bigint,
  'the place is deleted on the server too'
);

select is(
  public.push_synced_rows('place_rate', '[{"id": "aaaaaaaa-0000-0000-0000-000000000005", "place_id": "aaaaaaaa-0000-0000-0000-0000000000ff", "day_type": "weekday", "type": "hourly", "first_minutes": 60, "first_sen": 300, "block_minutes": 60, "block_sen": 200, "grace_minutes": 0, "daily_cap_sen": null, "flat_sen": null, "created_at": 1792800000000, "updated_at": 1792800000000, "deleted_at": null}]') -> 0 ->> 'code',
  '23503',
  'a rate for a place the server does not have is refused'
);

select is(
  public.push_synced_rows('public_holiday', '[{"id": "aaaaaaaa-0000-0000-0000-000000000006", "holiday_date": "2026-12-25", "name": "Christmas", "created_at": 1792800000000, "updated_at": 1792800000000, "deleted_at": null}]'),
  '[]'::jsonb,
  'A pushes a public holiday'
);
select is((select holiday_date from public.public_holiday), '2026-12-25'::date, 'a date arrives as a date');

-- Two active sessions for one car are refused, never merged (PLAN.md, "How
-- the sync works", step 8), with the server's one for the phone to show.
select is(
  public.push_synced_rows('parking_session', '[{"id": "aaaaaaaa-0000-0000-0000-000000000007", "vehicle_id": "aaaaaaaa-0000-0000-0000-000000000001", "place_id": "aaaaaaaa-0000-0000-0000-000000000002", "status": "active", "started_at": 1792800000000, "ended_at": null, "level": "B2", "bay": "C14", "zone_colour_name": null, "zone_colour_hex": null, "access_type": null, "landmark": null, "note": null, "rate_snapshot": {"weekday": {"type": "hourly", "first_minutes": 60, "first_sen": 300, "block_minutes": 60, "block_sen": 200}}, "timer_ends_at": null, "fee_sen": null, "paid_sen": null, "lat": null, "lng": null, "gps_accuracy_m": null, "created_at": 1792800000000, "updated_at": 1792800000000, "deleted_at": null}]'),
  '[]'::jsonb,
  'A pushes a parked car'
);
select is(
  (select jsonb_typeof(rate_snapshot) from public.parking_session),
  'object',
  'the rate snapshot arrives as JSON, not as a string'
);
select is(
  public.push_synced_rows('parking_session', '[{"id": "aaaaaaaa-0000-0000-0000-000000000008", "vehicle_id": "aaaaaaaa-0000-0000-0000-000000000001", "place_id": null, "status": "active", "started_at": 1792800100000, "ended_at": null, "level": "L3", "bay": null, "zone_colour_name": null, "zone_colour_hex": null, "access_type": null, "landmark": null, "note": null, "rate_snapshot": null, "timer_ends_at": null, "fee_sen": null, "paid_sen": null, "lat": null, "lng": null, "gps_accuracy_m": null, "created_at": 1792800100000, "updated_at": 1792800100000, "deleted_at": null}]'),
  '[{"id": "aaaaaaaa-0000-0000-0000-000000000008", "code": "23505", "constraint": "one_active_session_per_vehicle", "other": {"id": "aaaaaaaa-0000-0000-0000-000000000007", "level": "B2", "bay": "C14", "started_at": 1792800000000}}]'::jsonb,
  'a second active session for the car is refused, with the one already parked'
);
select is(
  public.push_synced_rows('parking_session', '[{"id": "aaaaaaaa-0000-0000-0000-000000000007", "vehicle_id": "aaaaaaaa-0000-0000-0000-000000000001", "place_id": "aaaaaaaa-0000-0000-0000-000000000002", "status": "ended", "started_at": 1792800000000, "ended_at": 1792800090000, "level": "B2", "bay": "C14", "zone_colour_name": null, "zone_colour_hex": null, "access_type": null, "landmark": null, "note": null, "rate_snapshot": null, "timer_ends_at": null, "fee_sen": 500, "paid_sen": null, "lat": null, "lng": null, "gps_accuracy_m": null, "created_at": 1792800000000, "updated_at": 1792800090000, "deleted_at": null}, {"id": "aaaaaaaa-0000-0000-0000-000000000008", "vehicle_id": "aaaaaaaa-0000-0000-0000-000000000001", "place_id": null, "status": "active", "started_at": 1792800100000, "ended_at": null, "level": "L3", "bay": null, "zone_colour_name": null, "zone_colour_hex": null, "access_type": null, "landmark": null, "note": null, "rate_snapshot": null, "timer_ends_at": null, "fee_sen": null, "paid_sen": null, "lat": null, "lng": null, "gps_accuracy_m": null, "created_at": 1792800100000, "updated_at": 1792800100000, "deleted_at": null}]'),
  '[]'::jsonb,
  'once one of them has ended, the other goes in'
);

select is(
  public.push_synced_rows('vehicle', '[{"id": "aaaaaaaa-0000-0000-0000-000000000009"}]') -> 0 ->> 'code',
  '22023',
  'a row with nothing to change is refused, not the whole push'
);

select throws_ok(
  $$ select public.push_synced_rows('photo', '[]') $$,
  'P0001',
  'Not a synced table: photo',
  'only the five synced tables can be pushed'
);

-- User B pushes rows with A's ids, as a phone backed up to A does when its
-- data is added to B (PLAN.md, "How the sync works", step 9): they become
-- B's own rows, and A's are left alone.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';

select is(
  public.push_synced_rows('vehicle', '[{"id": "aaaaaaaa-0000-0000-0000-000000000001", "name": "Taken", "colour": "Blue", "is_default": false, "archived": false, "created_at": 1792800000000, "updated_at": 1792700000000, "deleted_at": null}]'),
  '[]'::jsonb,
  'B pushes a car with an id A has too'
);
select is(
  (select owner_id from public.vehicle where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  '00000000-0000-0000-0000-00000000000b'::uuid,
  'it is B''s own car, although the change is older than A''s'
);
select is(
  public.push_synced_rows('parking_session', '[{"id": "aaaaaaaa-0000-0000-0000-000000000008", "vehicle_id": "aaaaaaaa-0000-0000-0000-000000000001", "place_id": null, "status": "active", "started_at": 1792800100000, "ended_at": null, "level": "B9", "bay": null, "zone_colour_name": null, "zone_colour_hex": null, "access_type": null, "landmark": null, "note": null, "rate_snapshot": null, "timer_ends_at": null, "fee_sen": null, "paid_sen": null, "lat": null, "lng": null, "gps_accuracy_m": null, "created_at": 1792800100000, "updated_at": 1792800100000, "deleted_at": null}]'),
  '[]'::jsonb,
  'B parks its car while A''s car with the same id is parked'
);
select is(
  (select level from public.parking_session where id = 'aaaaaaaa-0000-0000-0000-000000000008'),
  'B9',
  'B''s session arrived, although A has one with the same id and time'
);
select is(
  public.push_synced_rows('place', '[{"id": "aaaaaaaa-0000-0000-0000-000000000002", "name": "The Gardens", "note": null, "lat": null, "lng": null, "last_used_at": null, "created_at": 1792800000000, "updated_at": 1792800000000, "deleted_at": null}]'),
  '[]'::jsonb,
  'B pushes a place with an id A has too'
);
select is(
  public.push_synced_rows('place_rate', '[{"id": "bbbbbbbb-0000-0000-0000-000000000005", "place_id": "aaaaaaaa-0000-0000-0000-000000000002", "day_type": "weekday", "type": "flat", "first_minutes": null, "first_sen": null, "block_minutes": null, "block_sen": null, "grace_minutes": 0, "daily_cap_sen": null, "flat_sen": 500, "created_at": 1792800000000, "updated_at": 1792800000000, "deleted_at": null}]'),
  '[]'::jsonb,
  'and a weekday rate for it'
);
select is(
  public.push_synced_rows('vehicle', '[{"id": "bbbbbbbb-0000-0000-0000-000000000001", "name": "B car", "colour": null, "is_default": true, "archived": false, "created_at": 1792800000000, "updated_at": 1792800000000, "deleted_at": null}, {"id": "not-a-uuid", "name": "Bad", "colour": null, "is_default": false, "archived": false, "created_at": 1792800000000, "updated_at": 1792800000000, "deleted_at": null}]'),
  '[{"id": "not-a-uuid", "code": "22P02", "constraint": null, "other": null}]'::jsonb,
  'B pushes a car of its own, and a row with a bad id is refused on its own'
);
select is((select count(*) from public.vehicle), 2::bigint, 'B sees only its own cars');

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

select is(
  (select name || ' ' || colour || ' ' || updated_at from public.vehicle where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  'Our Myvi Red 1792800090000',
  'A''s car is unchanged'
);
select is(
  (select level from public.parking_session where id = 'aaaaaaaa-0000-0000-0000-000000000008'),
  'L3',
  'A sees its own session with that id, not B''s'
);
select is(
  public.push_synced_rows('place_rate', '[{"id": "aaaaaaaa-0000-0000-0000-00000000000a", "place_id": "aaaaaaaa-0000-0000-0000-000000000002", "day_type": "weekday", "type": "flat", "first_minutes": null, "first_sen": null, "block_minutes": null, "block_sen": null, "grace_minutes": 0, "daily_cap_sen": null, "flat_sen": 300, "created_at": 1792800000000, "updated_at": 1792800000000, "deleted_at": null}]'),
  '[]'::jsonb,
  'A''s weekday rate for its place does not clash with B''s for the place with the same id'
);
select is(
  (select owner_id from public.vehicle where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  '00000000-0000-0000-0000-00000000000a'::uuid,
  'A sees only its own car with that id'
);

-- At most 64 rows per call (20261030115551); the phone sends 50 (PUSH_BATCH).
select is(
  public.push_synced_rows('public_holiday', (
    select jsonb_agg(jsonb_build_object(
      'id', 'bbbbbbbb-0000-0000-0000-' || lpad(n::text, 12, '0'),
      'holiday_date', (date '2027-01-01' + n)::text,
      'name', null,
      'created_at', 1792800000000,
      'updated_at', 1792800000000,
      'deleted_at', null
    ))
    from generate_series(1, 64) as n
  )),
  '[]'::jsonb,
  'a push of 64 rows is taken'
);
select throws_ok(
  $$select public.push_synced_rows('public_holiday', (select jsonb_agg(jsonb_build_object('id', gen_random_uuid())) from generate_series(1, 65)))$$,
  '22023',
  'At most 64 rows per call, not 65',
  'a push of 65 rows is refused whole'
);

select * from finish();
rollback;
