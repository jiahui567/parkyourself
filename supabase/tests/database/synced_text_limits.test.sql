begin;
select plan(15);

-- The text limits (20261030124922): the phone's lengths, so a row the phone
-- takes is never refused here, and one over them is refused alone.
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000a', 'a@example.test');

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

select is(
  public.push_synced_rows('vehicle', jsonb_build_array(jsonb_build_object(
    'id', 'cccccccc-0000-0000-0000-000000000001', 'name', repeat('x', 100), 'colour', repeat('x', 100),
    'is_default', true, 'archived', false, 'created_at', 1792800000000, 'updated_at', 1792800000000, 'deleted_at', null
  ))),
  '[]'::jsonb,
  'a car name and colour of 100 characters are taken'
);
select is(
  (public.push_synced_rows('vehicle', jsonb_build_array(jsonb_build_object(
    'id', 'cccccccc-0000-0000-0000-000000000002', 'name', repeat('x', 101), 'is_default', false, 'archived', false,
    'created_at', 1792800000000, 'updated_at', 1792800000000
  ))) -> 0) - 'other',
  jsonb_build_object('id', 'cccccccc-0000-0000-0000-000000000002', 'code', '23514', 'constraint', 'vehicle_name_length'),
  'a car name of 101 characters is refused, as a broken rule'
);
select is(
  public.push_synced_rows('vehicle', jsonb_build_array(jsonb_build_object(
    'id', 'cccccccc-0000-0000-0000-000000000003', 'name', 'Axia', 'colour', repeat('x', 101), 'is_default', false,
    'archived', false, 'created_at', 1792800000000, 'updated_at', 1792800000000
  ))) -> 0 ->> 'constraint',
  'vehicle_colour_length',
  'a car colour of 101 characters is refused'
);

select is(
  public.push_synced_rows('place', jsonb_build_array(jsonb_build_object(
    'id', 'cccccccc-0000-0000-0000-000000000004', 'name', repeat('p', 100), 'note', repeat('n', 500),
    'created_at', 1792800000000, 'updated_at', 1792800000000
  ))),
  '[]'::jsonb,
  'a place name of 100 and a note of 500 characters are taken'
);
select is(
  public.push_synced_rows('place', jsonb_build_array(jsonb_build_object(
    'id', 'cccccccc-0000-0000-0000-000000000005', 'name', repeat('q', 101), 'created_at', 1792800000000,
    'updated_at', 1792800000000
  ))) -> 0 ->> 'constraint',
  'place_name_length',
  'a place name of 101 characters is refused'
);
select is(
  public.push_synced_rows('place', jsonb_build_array(jsonb_build_object(
    'id', 'cccccccc-0000-0000-0000-000000000006', 'name', 'Mid Valley', 'note', repeat('n', 501),
    'created_at', 1792800000000, 'updated_at', 1792800000000
  ))) -> 0 ->> 'constraint',
  'place_note_length',
  'a place note of 501 characters is refused'
);

select is(
  public.push_synced_rows('public_holiday', jsonb_build_array(jsonb_build_object(
    'id', 'cccccccc-0000-0000-0000-000000000007', 'holiday_date', '2026-12-25', 'name', repeat('h', 101),
    'created_at', 1792800000000, 'updated_at', 1792800000000
  ))) -> 0 ->> 'constraint',
  'public_holiday_name_length',
  'a holiday name of 101 characters is refused'
);

-- Sessions of the car above, each with one column at or over its limit.
create temporary table session_base on commit drop as
select jsonb_build_object(
  'vehicle_id', 'cccccccc-0000-0000-0000-000000000001', 'status', 'ended', 'started_at', 1792800000000,
  'ended_at', 1792803600000, 'created_at', 1792800000000, 'updated_at', 1792803600000
) as row;

select is(
  public.push_synced_rows('parking_session', jsonb_build_array((select row from session_base) || jsonb_build_object(
    'id', 'cccccccc-0000-0000-0000-000000000010', 'level', repeat('L', 20), 'bay', repeat('B', 20),
    'zone_colour_name', repeat('z', 100), 'zone_colour_hex', '#1E5BD8', 'landmark', repeat('s', 100),
    'note', repeat('n', 500), 'rate_snapshot', jsonb_build_object('weekday', null, 'weekend', null, 'holiday', null)
  ))),
  '[]'::jsonb,
  'a session at every limit is taken'
);
select is(
  public.push_synced_rows('parking_session', jsonb_build_array((select row from session_base) || jsonb_build_object(
    'id', 'cccccccc-0000-0000-0000-000000000011', 'level', repeat('L', 21)
  ))) -> 0 ->> 'constraint',
  'parking_session_level_length',
  'a level of 21 characters is refused'
);
select is(
  public.push_synced_rows('parking_session', jsonb_build_array((select row from session_base) || jsonb_build_object(
    'id', 'cccccccc-0000-0000-0000-000000000012', 'bay', repeat('B', 21)
  ))) -> 0 ->> 'constraint',
  'parking_session_bay_length',
  'a bay of 21 characters is refused'
);
select is(
  public.push_synced_rows('parking_session', jsonb_build_array((select row from session_base) || jsonb_build_object(
    'id', 'cccccccc-0000-0000-0000-000000000013', 'zone_colour_name', repeat('z', 101)
  ))) -> 0 ->> 'constraint',
  'parking_session_zone_colour_name_length',
  'a zone colour name of 101 characters is refused'
);
select is(
  public.push_synced_rows('parking_session', jsonb_build_array((select row from session_base) || jsonb_build_object(
    'id', 'cccccccc-0000-0000-0000-000000000014', 'landmark', repeat('s', 101)
  ))) -> 0 ->> 'constraint',
  'parking_session_landmark_length',
  'a first shop of 101 characters is refused'
);
select is(
  public.push_synced_rows('parking_session', jsonb_build_array((select row from session_base) || jsonb_build_object(
    'id', 'cccccccc-0000-0000-0000-000000000015', 'note', repeat('n', 501)
  ))) -> 0 ->> 'constraint',
  'parking_session_note_length',
  'a parking note of 501 characters is refused'
);
select is(
  public.push_synced_rows('parking_session', jsonb_build_array((select row from session_base) || jsonb_build_object(
    'id', 'cccccccc-0000-0000-0000-000000000016', 'zone_colour_hex', 'not a colour'
  ))) -> 0 ->> 'constraint',
  'parking_session_zone_colour_hex_format',
  'a zone colour that is not #RRGGBB is refused'
);
select is(
  public.push_synced_rows('parking_session', jsonb_build_array((select row from session_base) || jsonb_build_object(
    'id', 'cccccccc-0000-0000-0000-000000000017', 'rate_snapshot', jsonb_build_object('weekday', repeat('r', 9000))
  ))) -> 0 ->> 'constraint',
  'parking_session_rate_snapshot_size',
  'a rate snapshot over 8 KB is refused'
);

select * from finish();
rollback;
