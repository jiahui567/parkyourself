begin;
select plan(17);

select function_privs_are('public', 'pull_synced_rows', array['text', 'bigint', 'uuid', 'integer'], 'anon',
  array[]::text[], 'anon cannot pull');
select function_privs_are('public', 'pull_synced_rows', array['text', 'bigint', 'uuid', 'integer'], 'authenticated',
  array['EXECUTE'], 'a signed-in user can pull');
select has_column('public', 'place', 'merged_into', 'a place can name the place it was merged into');
select has_column('public', 'vehicle', 'merged_into', 'a car can name the car it was merged into');

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.test'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.test');

set local role authenticated;

-- B's car, which A must never get.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';
select public.push_synced_rows('vehicle', '[{"id": "bbbbbbbb-0000-0000-0000-000000000001", "name": "B''s car", "is_default": true, "archived": false, "created_at": 1792800000000, "updated_at": 1792800000000, "deleted_at": null}]');

-- A's rows, the way src/cloud/sync.js pushes them. Everything here is one
-- transaction, so every row has the same server_updated_at, as the rows of
-- one push do: the pages must tell them apart by id.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';
select public.push_synced_rows('vehicle', '[{"id": "aaaaaaaa-0000-0000-0000-000000000002", "name": "My Axia", "is_default": false, "archived": false, "created_at": 1792800000000, "updated_at": 1792800060000, "deleted_at": 1792800060000}, {"id": "aaaaaaaa-0000-0000-0000-000000000001", "name": "My Myvi", "is_default": true, "archived": false, "created_at": 1792800000000, "updated_at": 1792800000000, "deleted_at": null}]');
select public.push_synced_rows('place', '[{"id": "aaaaaaaa-0000-0000-0000-000000000003", "name": "Pavilion", "created_at": 1792800000000, "updated_at": 1792800060000, "deleted_at": 1792800060000, "merged_into": "aaaaaaaa-0000-0000-0000-000000000004"}, {"id": "aaaaaaaa-0000-0000-0000-000000000004", "name": "Pavilion", "created_at": 1792800030000, "updated_at": 1792800030000, "deleted_at": null}]');

-- The ids of a pull, in the order given.
create function pg_temp.ids(p_rows jsonb) returns text[] language sql as $$
  select coalesce(array_agg(r ->> 'id' order by n), '{}') from jsonb_array_elements(p_rows) with ordinality as e(r, n)
$$;

select is(
  pg_temp.ids(public.pull_synced_rows('vehicle', null, null, 100)),
  array['aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002'],
  'A pulls her own cars, not B''s, oldest change first and then by id'
);
select is(
  public.pull_synced_rows('vehicle', null, null, 100) -> 1 ->> 'deleted_at',
  '1792800060000',
  'a deleted car is pulled too, with the phone''s time unchanged'
);
select ok(
  not (public.pull_synced_rows('vehicle', null, null, 100) -> 0 ?| array['owner_id', 'server_updated_at']),
  'the server''s own columns stay on the server'
);
select is(
  (public.pull_synced_rows('vehicle', null, null, 100) -> 0 ->> 'server_updated_us')::bigint,
  (extract(epoch from now()) * 1000000)::bigint,
  'server_updated_us is the stamp in whole microseconds'
);
select is(
  public.pull_synced_rows('vehicle', null, null, 100) -> 0 -> 'is_default',
  'true'::jsonb,
  'a boolean comes back as a boolean'
);

-- Pages.
select is(
  pg_temp.ids(public.pull_synced_rows('vehicle', null, null, 1)),
  array['aaaaaaaa-0000-0000-0000-000000000001'],
  'a page holds at most the limit'
);
select is(
  pg_temp.ids(public.pull_synced_rows('vehicle', (extract(epoch from now()) * 1000000)::bigint,
    'aaaaaaaa-0000-0000-0000-000000000001', 100)),
  array['aaaaaaaa-0000-0000-0000-000000000002'],
  'the next page starts after the last row, among rows with the same stamp'
);
select is(
  pg_temp.ids(public.pull_synced_rows('vehicle', (extract(epoch from now()) * 1000000)::bigint, null, 100)),
  '{}'::text[],
  'with no id, only rows stamped later'
);
select is(
  jsonb_array_length(public.pull_synced_rows('vehicle', (extract(epoch from now()) * 1000000)::bigint - 1, null, 100)),
  2,
  'rows stamped after the point'
);

select is(
  public.pull_synced_rows('place', null, null, 100) -> 0 ->> 'merged_into',
  'aaaaaaaa-0000-0000-0000-000000000004',
  'merged_into comes with a merged place, which freed its name for the other'
);

select throws_ok(
  $$ select public.pull_synced_rows('photo', null, null, 10) $$,
  'P0001',
  'Not a synced table: photo',
  'only the five synced tables'
);

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';
select is(
  pg_temp.ids(public.pull_synced_rows('vehicle', null, null, 100)),
  array['bbbbbbbb-0000-0000-0000-000000000001'],
  'B pulls only B''s car'
);

reset role;
set local role anon;
select throws_ok(
  $$ select public.pull_synced_rows('vehicle', null, null, 10) $$,
  '42501',
  null,
  'signed out, nothing can be pulled'
);

select * from finish();
rollback;
