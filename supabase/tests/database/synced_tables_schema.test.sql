begin;
select plan(36);

select hasnt_table('public', 'connection_check', 'C0''s connection_check is gone');

-- The phone's columns (src/db/migrations.js) plus owner_id and server_updated_at.
-- test/serverColumns.test.js reads these lists and checks them against the
-- phone's schema, so a column added on one side only fails one of the two.
select columns_are('public', 'vehicle', array[
  'id', 'owner_id', 'name', 'colour', 'is_default', 'archived', 'merged_into',
  'created_at', 'updated_at', 'deleted_at', 'server_updated_at'
], 'vehicle has the phone''s columns');
select columns_are('public', 'place', array[
  'id', 'owner_id', 'name', 'note', 'lat', 'lng', 'last_used_at', 'merged_into',
  'created_at', 'updated_at', 'deleted_at', 'server_updated_at'
], 'place has the phone''s columns');
select columns_are('public', 'place_rate', array[
  'id', 'owner_id', 'place_id', 'day_type', 'type', 'first_minutes', 'first_sen', 'block_minutes',
  'block_sen', 'grace_minutes', 'daily_cap_sen', 'flat_sen',
  'created_at', 'updated_at', 'deleted_at', 'server_updated_at'
], 'place_rate has the phone''s columns');
select columns_are('public', 'public_holiday', array[
  'id', 'owner_id', 'holiday_date', 'name',
  'created_at', 'updated_at', 'deleted_at', 'server_updated_at'
], 'public_holiday has the phone''s columns');
select columns_are('public', 'parking_session', array[
  'id', 'owner_id', 'vehicle_id', 'place_id', 'status', 'started_at', 'ended_at', 'level', 'bay',
  'zone_colour_name', 'zone_colour_hex', 'access_type', 'landmark', 'note', 'rate_snapshot',
  'timer_ends_at', 'fee_sen', 'paid_sen', 'lat', 'lng', 'gps_accuracy_m',
  'created_at', 'updated_at', 'deleted_at', 'server_updated_at'
], 'parking_session has the phone''s columns');

-- PLAN.md, "Type mapping".
select is_empty($$
  select table_name, column_name, data_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name in ('vehicle', 'place', 'place_rate', 'public_holiday', 'parking_session')
    and (
      (column_name in ('id', 'owner_id', 'vehicle_id', 'place_id', 'merged_into') and data_type <> 'uuid')
      or (column_name like '%\_at' and column_name <> 'server_updated_at' and data_type <> 'bigint')
      or (column_name = 'server_updated_at' and data_type <> 'timestamp with time zone')
      or ((column_name like '%\_sen' or column_name like '%\_minutes') and data_type <> 'bigint')
    )
$$, 'ids are uuid, phone times, sen and minutes are bigint, server_updated_at is timestamptz');
select col_type_is('public', 'vehicle', 'is_default', 'boolean', 'vehicle.is_default is boolean');
select col_type_is('public', 'vehicle', 'archived', 'boolean', 'vehicle.archived is boolean');
select col_type_is('public', 'public_holiday', 'holiday_date', 'date', 'public_holiday.holiday_date is a date');
select col_type_is('public', 'parking_session', 'rate_snapshot', 'jsonb', 'parking_session.rate_snapshot is jsonb');

select ok(
  (select bool_and(relrowsecurity) from pg_class where oid in (
    'public.vehicle'::regclass, 'public.place'::regclass, 'public.place_rate'::regclass,
    'public.public_holiday'::regclass, 'public.parking_session'::regclass
  )),
  'row level security is on for all five'
);

-- A row is known by its id and its owner, so one phone's rows can be backed
-- up to two accounts (PLAN.md, "How the sync works", step 9).
select col_is_pk('public', t, array['id', 'owner_id']::name[], t || ' is keyed by id and owner')
from unnest(array['vehicle', 'place', 'place_rate', 'public_holiday', 'parking_session']) as t;

-- One index on (id, owner_id), the primary key, which the foreign keys use
-- (20261030115747).
select is(
  (select count(*)::int from pg_catalog.pg_constraint where conrelid = format('public.%I', t)::regclass and contype = 'u'),
  0,
  t || ' has no second key on (id, owner_id)'
)
from unnest(array['vehicle', 'place']) as t;

-- Without it a table's updates keep their old stamp and the pull misses them;
-- the column default alone hides that on insert.
select has_trigger('public', t, 'set_server_updated_at', t || ' stamps server_updated_at')
from unnest(array['vehicle', 'place', 'place_rate', 'public_holiday', 'parking_session']) as t;

-- Signed out gets nothing; signed in gets no delete (rows are soft-deleted).
select table_privs_are('public', t, 'anon', array[]::text[], 'anon has no access to ' || t)
from unnest(array['vehicle', 'place', 'place_rate', 'public_holiday', 'parking_session']) as t;
select table_privs_are('public', t, 'authenticated', array['SELECT', 'INSERT', 'UPDATE'],
  'authenticated may read, add and change ' || t || ', not delete')
from unnest(array['vehicle', 'place', 'place_rate', 'public_holiday', 'parking_session']) as t;

select function_privs_are('public', 'set_server_updated_at', array[]::name[], 'anon', array[]::text[],
  'anon cannot call the trigger function');
select function_privs_are('public', 'set_server_updated_at', array[]::name[], 'authenticated', array[]::text[],
  'authenticated cannot call the trigger function');

select * from finish();
rollback;
