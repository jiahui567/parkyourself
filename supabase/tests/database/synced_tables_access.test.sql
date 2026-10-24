begin;
select plan(39);

-- Two users, as Supabase Auth makes them on sign-in.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.test'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.test');

-- As user A, the way the app's sync will call: signed in, sending rows
-- without owner_id.
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

select lives_ok($$
  insert into public.vehicle (id, name, is_default, created_at, updated_at, server_updated_at)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'My Myvi', true, 1792800000000, 1792800000000, '2000-01-01')
$$, 'A adds a car');
select lives_ok($$
  insert into public.place (id, name, lat, lng, created_at, updated_at)
  values ('aaaaaaaa-0000-0000-0000-000000000002', 'Pavilion Bukit Jalil', 3.0, 101.7, 1792800000000, 1792800000000)
$$, 'A adds a place');
select lives_ok($$
  insert into public.place_rate
    (id, place_id, day_type, type, first_minutes, first_sen, block_minutes, block_sen, created_at, updated_at)
  values ('aaaaaaaa-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000002', 'weekday', 'hourly',
    60, 300, 60, 200, 1792800000000, 1792800000000)
$$, 'A adds a rate to the place');
select lives_ok($$
  insert into public.public_holiday (id, holiday_date, name, created_at, updated_at)
  values ('aaaaaaaa-0000-0000-0000-000000000004', '2026-12-25', 'Christmas', 1792800000000, 1792800000000)
$$, 'A adds a public holiday');
select lives_ok($$
  insert into public.parking_session
    (id, vehicle_id, place_id, status, started_at, level, bay, rate_snapshot, created_at, updated_at)
  values ('aaaaaaaa-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000001',
    'aaaaaaaa-0000-0000-0000-000000000002', 'active', 1792800000000, 'B2', 'C14',
    '{"weekday": {"type": "hourly", "first_minutes": 60, "first_sen": 300, "block_minutes": 60, "block_sen": 200}}',
    1792800000000, 1792800000000)
$$, 'A parks the car at the place');

-- So that "B sees none of A's rows" below means the policy, not "nobody can read".
select ok(exists (select 1 from public.place), 'A reads its own places');
select ok(exists (select 1 from public.place_rate), 'A reads its own rates');
select ok(exists (select 1 from public.public_holiday), 'A reads its own holidays');
select ok(exists (select 1 from public.parking_session), 'A reads its own sessions');

select is(
  (select owner_id from public.vehicle where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  '00000000-0000-0000-0000-00000000000a'::uuid,
  'owner_id is the signed-in user'
);
select is(
  (select server_updated_at from public.vehicle where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  now(),
  'an insert takes the server''s clock, not the value sent'
);
select lives_ok($$
  update public.vehicle set name = 'Our Myvi', updated_at = 1792800060000, server_updated_at = '2000-01-01'
  where id = 'aaaaaaaa-0000-0000-0000-000000000001'
$$, 'A renames the car');
select is(
  (select server_updated_at from public.vehicle where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  now(),
  'an update takes the server''s clock too'
);

-- The phone's unique rules hold per owner, and only among live rows.
select lives_ok($$
  insert into public.place (id, name, created_at, updated_at)
  values ('aaaaaaaa-0000-0000-0000-000000000006', 'Mid Valley', 1792800000000, 1792800000000)
$$, 'A adds a second place');
select lives_ok($$
  update public.place set deleted_at = 1792800060000, updated_at = 1792800060000
  where id = 'aaaaaaaa-0000-0000-0000-000000000006'
$$, 'A soft-deletes it');
select lives_ok($$
  insert into public.place (id, name, created_at, updated_at)
  values ('aaaaaaaa-0000-0000-0000-000000000007', 'MID VALLEY', 1792800120000, 1792800120000)
$$, 'a deleted place''s name can be used again');
select throws_ok($$
  insert into public.place (id, name, created_at, updated_at)
  values ('aaaaaaaa-0000-0000-0000-000000000008', 'pavilion bukit jalil', 1792800000000, 1792800000000)
$$, '23505', null, 'A cannot have two live places with the same name, in any case');
select lives_ok($$
  insert into public.place (id, name, created_at, updated_at)
  values ('aaaaaaaa-0000-0000-0000-000000000014', 'Café', 1792800000000, 1792800000000),
    ('aaaaaaaa-0000-0000-0000-000000000015', 'CAFÉ', 1792800000000, 1792800000000)
$$, 'names that differ only in a non-English letter''s case are two places, as on the phone');
select throws_ok($$
  insert into public.place_rate (id, place_id, day_type, type, flat_sen, created_at, updated_at)
  values ('aaaaaaaa-0000-0000-0000-000000000009', 'aaaaaaaa-0000-0000-0000-000000000002', 'weekday', 'flat',
    500, 1792800000000, 1792800000000)
$$, '23505', null, 'a place has one live rate per day type');
select throws_ok($$
  insert into public.place_rate (id, place_id, day_type, type, first_sen, created_at, updated_at)
  values ('aaaaaaaa-0000-0000-0000-000000000010', 'aaaaaaaa-0000-0000-0000-000000000002', 'holiday', 'hourly',
    300, 1792800000000, 1792800000000)
$$, '23514', null, 'a holiday rate must be flat');
select throws_ok($$
  insert into public.public_holiday (id, holiday_date, created_at, updated_at)
  values ('aaaaaaaa-0000-0000-0000-000000000011', '2026-12-25', 1792800000000, 1792800000000)
$$, '23505', null, 'A cannot have the same holiday date twice');
select throws_ok($$
  insert into public.parking_session (id, vehicle_id, status, started_at, created_at, updated_at)
  values ('aaaaaaaa-0000-0000-0000-000000000012', 'aaaaaaaa-0000-0000-0000-000000000001', 'active',
    1792800000000, 1792800000000, 1792800000000)
$$, '23505', null, 'a car has one active session');

select throws_ok(
  'delete from public.parking_session',
  '42501', null, 'A cannot delete rows: they are soft-deleted'
);
select throws_ok($$
  update public.vehicle set owner_id = '00000000-0000-0000-0000-00000000000b'
  where id = 'aaaaaaaa-0000-0000-0000-000000000001'
$$, '42501', null, 'A cannot give a car to another user');
select throws_ok($$
  insert into public.place (id, owner_id, name, created_at, updated_at)
  values ('aaaaaaaa-0000-0000-0000-000000000013', '00000000-0000-0000-0000-00000000000b', 'Sunway Pyramid',
    1792800000000, 1792800000000)
$$, '42501', null, 'A cannot add a row as another user');

-- As user B.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';

select is((select count(*) from public.vehicle), 0::bigint, 'B sees none of A''s cars');
select is((select count(*) from public.place), 0::bigint, 'B sees none of A''s places');
select is((select count(*) from public.place_rate), 0::bigint, 'B sees none of A''s rates');
select is((select count(*) from public.public_holiday), 0::bigint, 'B sees none of A''s holidays');
select is((select count(*) from public.parking_session), 0::bigint, 'B sees none of A''s sessions');
select lives_ok($$
  update public.vehicle set name = 'Stolen' where id = 'aaaaaaaa-0000-0000-0000-000000000001'
$$, 'B''s update of A''s car runs but matches nothing');
select throws_ok($$
  insert into public.parking_session (id, vehicle_id, status, started_at, created_at, updated_at)
  values ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'ended',
    1792800000000, 1792800000000, 1792800000000)
$$, '23503', null, 'B cannot add a session to A''s car');
select throws_ok($$
  insert into public.place_rate (id, place_id, day_type, type, flat_sen, created_at, updated_at)
  values ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002', 'weekend', 'flat',
    500, 1792800000000, 1792800000000)
$$, '23503', null, 'B cannot add a rate to A''s place');
select lives_ok($$
  insert into public.place (id, name, created_at, updated_at)
  values ('bbbbbbbb-0000-0000-0000-000000000003', 'Pavilion Bukit Jalil', 1792800000000, 1792800000000)
$$, 'B can have a place with the same name as A''s');

-- Signed out.
set local role anon;

select throws_ok('select * from public.vehicle', '42501', null, 'anon cannot read cars');

-- As the database owner: what the users could not see.
reset role;

select is(
  (select name from public.vehicle where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  'Our Myvi',
  'B''s update did not change A''s car'
);
select lives_ok(
  $$delete from auth.users where id = '00000000-0000-0000-0000-00000000000a'$$,
  'deleting A''s account works'
);
select is(
  (select (select count(*) from public.vehicle where owner_id = '00000000-0000-0000-0000-00000000000a')
        + (select count(*) from public.place where owner_id = '00000000-0000-0000-0000-00000000000a')
        + (select count(*) from public.place_rate where owner_id = '00000000-0000-0000-0000-00000000000a')
        + (select count(*) from public.public_holiday where owner_id = '00000000-0000-0000-0000-00000000000a')
        + (select count(*) from public.parking_session where owner_id = '00000000-0000-0000-0000-00000000000a')),
  0::bigint,
  'deleting A''s account deletes every row A owned'
);
select is(
  (select count(*) from public.place where owner_id = '00000000-0000-0000-0000-00000000000b'),
  1::bigint,
  'B''s rows stay'
);

select * from finish();
rollback;
