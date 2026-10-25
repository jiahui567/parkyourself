begin;
select plan(62);

-- A car park on the list, and three users as Supabase Auth makes them: A and
-- B signed in with an email, C anonymously.
insert into public.car_park (id, name, source_url, checked_on)
values ('test-mall', 'Test Mall', 'https://example.test/parking', '2026-10-01');
insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.test', false),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.test', false),
  ('00000000-0000-0000-0000-00000000000c', null, true);

-- What each role may do, before any row exists.
select ok((select relrowsecurity from pg_class where oid = 'public.rate_report'::regclass), 'rate_report has RLS on');
select table_privs_are('public', 'rate_report', 'anon', array[]::text[], 'anon has no table-wide access');
select table_privs_are('public', 'rate_report', 'authenticated', array['SELECT'], 'authenticated reads; inserts only some columns');
select column_privs_are('public', 'rate_report', 'status', 'authenticated', array['SELECT'], 'a user cannot set a status');
select column_privs_are('public', 'rate_report', 'reporter_id', 'authenticated', array['SELECT'], 'a user cannot set who sent it');
select column_privs_are('public', 'rate_report', 'rates', 'anon', array['SELECT'], 'anon reads the rates');
select function_privs_are('public', 'delete_my_account', array[]::text[], 'anon', array[]::text[], 'anon cannot delete an account');
select function_privs_are('public', 'delete_my_account', array[]::text[], 'authenticated', array['EXECUTE'], 'a user can delete their own account');
select function_privs_are('public', 'limit_rate_reports', array[]::text[], 'authenticated', array[]::text[], 'the trigger functions cannot be called');
select results_eq(
  $$select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'report-photos'$$,
  $$values (false, 2097152::bigint, array['image/jpeg'])$$,
  'report-photos is a private bucket of JPEGs up to 2 MB'
);

-- As A, the way the app sends: signed in, with no reporter_id or status.
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated", "is_anonymous": false}';

select lives_ok($$
  insert into public.rate_report (id, car_park_id, rates, note, photo_path)
  values ('cccccccc-0000-0000-0000-000000000001', 'test-mall',
    '{"weekday": {"type": "hourly", "first_minutes": 60, "first_sen": 300, "block_minutes": 60, "block_sen": 200, "grace_minutes": 0, "daily_cap_sen": null, "flat_sen": null}, "weekend": null, "holiday": {"type": "flat", "flat_sen": 500}}',
    'New board at the entrance', '00000000-0000-0000-0000-00000000000a/cccccccc-0000-0000-0000-000000000001.jpg')
$$, 'A reports a rate change for a listed car park');
select results_eq(
  $$select reporter_id, status, created_at, reviewed_at from public.rate_report where id = 'cccccccc-0000-0000-0000-000000000001'$$,
  $$values ('00000000-0000-0000-0000-00000000000a'::uuid, 'pending', now(), null::timestamptz)$$,
  'the server fills in who sent it, pending and the time'
);
select throws_ok($$
  insert into public.rate_report (car_park_id, rates, status)
  values ('test-mall', '{"weekday": {"type": "flat", "flat_sen": 100}}', 'approved')
$$, '42501', null, 'A cannot approve their own report');
select throws_ok($$
  insert into public.rate_report (car_park_id, rates, reporter_id)
  values ('test-mall', '{"weekday": {"type": "flat", "flat_sen": 100}}', '00000000-0000-0000-0000-00000000000b')
$$, '42501', null, 'A cannot send a report as B');
select throws_ok($$
  insert into public.rate_report (car_park_id, rates) values ('test-mall', '{"weekend": {"type": "flat", "flat_sen": 100}}')
$$, '23505', null, 'one report waits per user and car park');

-- The rates are checked on the server: anyone can call the API directly.
select throws_ok($$
  insert into public.rate_report (car_park_id, name, rates)
  values ('test-mall', 'Test Mall', '{"weekday": {"type": "flat", "flat_sen": 100}}')
$$, '23514', null, 'a report is about a listed car park or a new name, not both');
select throws_ok($$
  insert into public.rate_report (rates) values ('{"weekday": {"type": "flat", "flat_sen": 100}}')
$$, '23514', null, 'a report names its car park');
select throws_ok($$
  insert into public.rate_report (name, rates)
  values ('Other Mall', '{"holiday": {"type": "hourly", "first_minutes": 60, "first_sen": 300, "block_minutes": 60, "block_sen": 200}}')
$$, '23514', null, 'a holiday rate must be flat');
select throws_ok($$
  insert into public.rate_report (name, rates) values ('Other Mall', '{"weekday": {"type": "flat", "flat_sen": 100, "evil": 1}}')
$$, '23514', null, 'a rate has only the fee fields');
select throws_ok($$
  insert into public.rate_report (name, rates) values ('Other Mall', '{"sunday": {"type": "flat", "flat_sen": 100}}')
$$, '23514', null, 'rates has only weekday, weekend and holiday');
select throws_ok($$
  insert into public.rate_report (name, rates) values ('Other Mall', '{"weekday": {"type": "flat", "flat_sen": "100"}}')
$$, '23514', null, 'an amount is a number');
select throws_ok($$
  insert into public.rate_report (name, rates) values ('Other Mall', '{"weekday": {"type": "flat", "flat_sen": 2.5}}')
$$, '23514', null, 'an amount is a whole number of sen');
select throws_ok($$
  insert into public.rate_report (name, rates) values ('Other Mall', '{"weekday": {"type": "flat", "flat_sen": 100001}}')
$$, '23514', null, 'an amount is at most RM 1,000');
select throws_ok($$
  insert into public.rate_report (name, rates)
  values ('Other Mall', '{"weekday": {"type": "hourly", "first_minutes": 0, "first_sen": 300, "block_minutes": 60, "block_sen": 200}}')
$$, '23514', null, 'a period is at least a minute');
select throws_ok($$
  insert into public.rate_report (name, rates) values ('Other Mall', '{"weekday": {"type": "hourly", "first_sen": 300}}')
$$, '23514', null, 'an hourly rate has all its fields');
select throws_ok($$
  insert into public.rate_report (name, rates) values ('Other Mall', '{"weekday": null}')
$$, '23514', null, 'a report has at least one rate');
select throws_ok($$
  insert into public.rate_report (id, name, rates, photo_path)
  values ('cccccccc-0000-0000-0000-000000000099', 'Other Mall', '{"weekday": {"type": "flat", "flat_sen": 100}}',
    '00000000-0000-0000-0000-00000000000b/cccccccc-0000-0000-0000-000000000099.jpg')
$$, '23514', null, 'the photo is in the sender''s own folder, named after the report');

-- The photo, written as the Storage API writes it: as the user, after the report.
select lives_ok($$
  insert into storage.objects (bucket_id, name)
  values ('report-photos', '00000000-0000-0000-0000-00000000000a/cccccccc-0000-0000-0000-000000000001.jpg')
$$, 'A uploads the photo their report names');
select throws_ok($$
  insert into storage.objects (bucket_id, name)
  values ('report-photos', '00000000-0000-0000-0000-00000000000a/cccccccc-0000-0000-0000-000000000098.jpg')
$$, '42501', null, 'no photo without a report that names it');

-- Signed out, as the daily download reads.
set local role anon;

select is(
  (select rates -> 'weekday' ->> 'first_sen' from public.rate_report where car_park_id = 'test-mall'),
  '300',
  'anyone reads what a pending report says'
);
select throws_ok('select reporter_id from public.rate_report', '42501', null, 'anon cannot see who sent it');
select throws_ok('select note from public.rate_report', '42501', null, 'anon cannot read the note');
select throws_ok('select photo_path from public.rate_report', '42501', null, 'anon cannot find the photo');
select throws_ok($$
  insert into public.rate_report (car_park_id, rates) values ('test-mall', '{"weekday": {"type": "flat", "flat_sen": 100}}')
$$, '42501', null, 'anon cannot send a report');
select throws_ok('select public.delete_my_account()', '42501', null, 'anon cannot call delete_my_account');

-- The developer approves it in Studio.
reset role;
update public.rate_report set status = 'approved' where id = 'cccccccc-0000-0000-0000-000000000001';
select isnt(
  (select reviewed_at from public.rate_report where id = 'cccccccc-0000-0000-0000-000000000001'),
  null,
  'approving stamps reviewed_at'
);

set local role anon;
select is((select count(*) from public.rate_report), 0::bigint, 'an approved report no longer shows as unverified');

-- A again.
set local role authenticated;
select is(
  (select status from public.rate_report where id = 'cccccccc-0000-0000-0000-000000000001'),
  'approved',
  'A sees their report was approved'
);
-- Deleting is through the Storage API, which sets this; the policy still decides.
set local storage.allow_delete_query = 'true';
select lives_ok($$
  delete from storage.objects where name = '00000000-0000-0000-0000-00000000000a/cccccccc-0000-0000-0000-000000000001.jpg'
$$, 'A can delete their own photo');
select throws_ok($$
  insert into storage.objects (bucket_id, name)
  values ('report-photos', '00000000-0000-0000-0000-00000000000a/cccccccc-0000-0000-0000-000000000001.jpg')
$$, '42501', null, 'a reviewed report takes no new photo');
select lives_ok($$
  insert into public.rate_report (id, car_park_id, rates, photo_path)
  values ('cccccccc-0000-0000-0000-000000000002', 'test-mall', '{"weekend": {"type": "flat", "flat_sen": 400}}',
    '00000000-0000-0000-0000-00000000000a/cccccccc-0000-0000-0000-000000000002.jpg')
$$, 'A can report the same car park again once the first is reviewed');
select lives_ok($$
  insert into storage.objects (bucket_id, name)
  values ('report-photos', '00000000-0000-0000-0000-00000000000a/cccccccc-0000-0000-0000-000000000002.jpg')
$$, 'with its photo');

-- More reports, up to the daily limit.
select lives_ok($$
  insert into public.rate_report (id, name, lat, lng, rates, photo_path)
  values ('cccccccc-0000-0000-0000-000000000003', 'Kedai Parking', 3.1, 101.6, '{"weekday": {"type": "flat", "flat_sen": 300}}',
    '00000000-0000-0000-0000-00000000000a/cccccccc-0000-0000-0000-000000000003.jpg')
$$, 'A suggests a car park that is not on the list');
select throws_ok($$
  insert into public.rate_report (name, rates) values ('KEDAI PARKING', '{"weekday": {"type": "flat", "flat_sen": 300}}')
$$, '23505', null, 'one suggestion waits per user and name, in any case');
select throws_ok($$
  insert into public.rate_report (name, rates) values (' Spaced ', '{"weekday": {"type": "flat", "flat_sen": 300}}')
$$, '23514', null, 'a name is trimmed');
select lives_ok($$
  insert into public.rate_report (name, rates) values
    ('Mall Four', '{"weekday": {"type": "flat", "flat_sen": 300}}'),
    ('Mall Five', '{"weekday": {"type": "flat", "flat_sen": 300}}')
$$, 'A sends a fifth report today');
select throws_ok($$
  insert into public.rate_report (name, rates) values ('Mall Six', '{"weekday": {"type": "flat", "flat_sen": 300}}')
$$, 'P0001', 'You can send at most 5 reports a day. Try again tomorrow.', 'the sixth report today is refused');
select is((select count(*) from public.rate_report), 5::bigint, 'A reads all five of their reports');

set local role anon;
select is(
  (select count(*) from public.rate_report),
  1::bigint,
  'signed out, only the pending report about a listed car park shows, not the suggestions'
);
select throws_ok(
  'select name, lat, lng, status from public.rate_report',
  '42501', null, 'anon cannot read a suggestion''s name or location, or a status'
);

-- As B.
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated", "is_anonymous": false}';

select is((select count(*) from public.rate_report), 0::bigint, 'B sees none of A''s reports');
select is(
  (select count(*) from storage.objects where bucket_id = 'report-photos'),
  0::bigint,
  'B sees none of A''s photos'
);
select throws_ok($$
  insert into storage.objects (bucket_id, name)
  values ('report-photos', '00000000-0000-0000-0000-00000000000a/cccccccc-0000-0000-0000-000000000003.jpg')
$$, '42501', null, 'B cannot upload the photo A''s report names');

-- As C, signed in anonymously.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000c", "role": "authenticated", "is_anonymous": true}';

select throws_ok($$
  insert into public.rate_report (car_park_id, rates) values ('test-mall', '{"weekday": {"type": "flat", "flat_sen": 100}}')
$$, '42501', null, 'an anonymous user cannot send a report');
select throws_ok($$
  insert into storage.objects (bucket_id, name)
  values ('report-photos', '00000000-0000-0000-0000-00000000000c/cccccccc-0000-0000-0000-000000000010.jpg')
$$, '42501', null, 'an anonymous user cannot upload a photo');

-- The developer rejects A's second report, then updates the car park list
-- the way `npm run carparks:sql` does: in place, so the reports stay.
reset role;
update public.rate_report set status = 'rejected' where id = 'cccccccc-0000-0000-0000-000000000002';
set local role anon;
select is((select count(*) from public.rate_report), 0::bigint, 'a rejected report no longer shows either');

reset role;
insert into public.car_park (id, name, source_url, checked_on)
values ('test-mall', 'Test Mall', 'https://example.test/parking', '2026-10-25')
on conflict (id) do update set checked_on = excluded.checked_on, updated_at = now();
select is(
  (select count(*) from public.rate_report where reporter_id = '00000000-0000-0000-0000-00000000000a'),
  5::bigint,
  'updating the car park list keeps the reports about it'
);

-- Deleting A's account.
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated", "is_anonymous": false}';

select throws_ok(
  'select public.delete_my_account()',
  'P0001', 'Delete your report photos first.', 'an account with photos left is not deleted'
);
-- The app deletes the photos through the Storage API first.
delete from storage.objects where bucket_id = 'report-photos';
select lives_ok('select public.delete_my_account()', 'A deletes their account');

reset role;
select is(
  (select count(*) from auth.users where id = '00000000-0000-0000-0000-00000000000a'),
  0::bigint,
  'A''s account is gone'
);
select is(
  (select count(*) from public.rate_report where reporter_id = '00000000-0000-0000-0000-00000000000a'),
  0::bigint,
  'A''s reports went with it'
);
select is(
  (select count(*) from auth.users where id = '00000000-0000-0000-0000-00000000000b'),
  1::bigint,
  'B''s account stays'
);

select * from finish();
rollback;
