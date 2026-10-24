begin;
select plan(7);

select has_table('public', 'connection_check', 'connection_check exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.connection_check'::regclass),
  'row level security is on'
);

-- Everything below runs as a signed-out app request.
set local role anon;

select results_eq(
  'select message from public.connection_check',
  $$values ('Hello from Supabase')$$,
  'anon can read the row'
);
select throws_ok(
  $$insert into public.connection_check (id, message) values (2, 'Not allowed')$$,
  '42501',
  null,
  'anon cannot insert'
);
select throws_ok(
  $$delete from public.connection_check$$,
  '42501',
  null,
  'anon cannot delete'
);
select throws_ok(
  $$update public.connection_check set message = 'Changed'$$,
  '42501',
  null,
  'anon cannot update'
);

-- A signed-in user gets no access at all: the migration grants only anon.
set local role authenticated;

select throws_ok(
  'select message from public.connection_check',
  '42501',
  null,
  'authenticated cannot read'
);

select * from finish();
rollback;
