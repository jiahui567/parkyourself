begin;
select plan(10);

select has_table('public', 'car_park', 'car_park exists');
select has_table('public', 'car_park_rate', 'car_park_rate exists');
select ok(
  (select bool_and(relrowsecurity) from pg_class where oid in ('public.car_park'::regclass, 'public.car_park_rate'::regclass)),
  'row level security is on for both'
);
select ok((select count(*) > 0 from public.car_park), 'the list has car parks');
select is(
  (select count(*) from public.car_park_rate where day_type = 'holiday' and type <> 'flat'),
  0::bigint,
  'every holiday rate is flat'
);

-- As the app, signed out: it reads the list and nothing else.
set local role anon;

select ok((select count(*) > 0 from public.car_park_rate), 'anon can read the rates');
select ok(
  (select count(*) > 0 from public.car_park c join public.car_park_rate r on r.car_park_id = c.id),
  'anon can read car parks with their rates'
);
select throws_ok(
  $$insert into public.car_park (id, name, source_url, checked_on) values ('x', 'X', 'https://x', '2026-10-24')$$,
  '42501',
  null,
  'anon cannot add a car park'
);
select throws_ok($$update public.car_park_rate set first_sen = 1$$, '42501', null, 'anon cannot change a rate');
select throws_ok($$delete from public.car_park$$, '42501', null, 'anon cannot delete a car park');

select * from finish();
rollback;
