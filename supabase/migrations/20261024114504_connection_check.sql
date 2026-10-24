-- C0 only: one row the app can read to prove it reaches Supabase, before sign-in exists (C2).
-- A later migration drops this table at the start of C1; never edit this file once it has been pushed.
create table public.connection_check (
  id integer primary key,
  message text not null
);

alter table public.connection_check enable row level security;

-- Start from no access whatever the project's default grants are, then allow only reading.
-- anon is the exception to "anon gets nothing" (PLAN.md), because nobody can sign in yet.
revoke all on public.connection_check from anon, authenticated;
grant select on public.connection_check to anon;

create policy "Anyone can read the connection check"
  on public.connection_check
  for select
  to anon
  using (true);

-- In the migration, not seed.sql: seed.sql only runs on local db reset, and hosted dev needs this row too.
insert into public.connection_check (id, message) values (1, 'Hello from Supabase');
