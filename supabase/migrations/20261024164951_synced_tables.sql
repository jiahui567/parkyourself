-- C1: the five synced tables, with the phone's columns (src/db/migrations.js)
-- plus owner_id and server_updated_at (PLAN.md, "How the sync works"). Each
-- signed-in user reads and writes only their own rows. Never edit this file
-- once it has been pushed.
--
-- Every SQLite INTEGER is bigint here: phone times (epoch ms) round-trip
-- unchanged, so last write wins compares the same numbers the phones wrote,
-- and SQLite integers are 64-bit while typed amounts have no cap, so a value
-- the phone holds never fails the push. Only server_updated_at is the
-- server's clock.
--
-- The rules (checks and unique indexes) are exactly the phone's, per owner:
-- looser, and a pull could bring rows the phone rejects; stricter, and a push
-- could fail on rows the phone accepted. Two phones that each made a clashing
-- row offline are sorted out by the sync (C3, C4), not here.

-- Sync order comes from the server's clock, so a phone with a wrong clock
-- cannot hide its rows from the pull. A value the phone sends is overwritten.
-- now() is when the transaction started, not when it committed, so the pull
-- reads with an overlap (PLAN.md, "How the sync works", step 4).
create function public.set_server_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.server_updated_at := now();
  return new;
end;
$$;

revoke execute on function public.set_server_updated_at() from public, anon, authenticated;

create table public.vehicle (
  id                 uuid primary key,
  owner_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name               text not null,
  colour             text,
  is_default         boolean not null default false,
  archived           boolean not null default false,
  created_at         bigint not null,
  updated_at         bigint not null,
  deleted_at         bigint,
  server_updated_at  timestamptz not null default now(),
  -- The target of the (id, owner_id) foreign keys below.
  unique (id, owner_id)
);

create table public.place (
  id                 uuid primary key,
  owner_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name               text not null,
  note               text,
  lat                double precision,
  lng                double precision,
  last_used_at       bigint,
  created_at         bigint not null,
  updated_at         bigint not null,
  deleted_at         bigint,
  server_updated_at  timestamptz not null default now(),
  unique (id, owner_id)
);

-- The phone's NOCASE folds only A to Z, and so does lower() under the C
-- collation, whatever the database's locale.
create unique index place_name_unique
  on public.place (owner_id, lower(name collate "C")) where deleted_at is null;

-- Foreign keys carry owner_id, so a row can point only at its owner's own place
-- or car: an id taken from someone else's data fails.
create table public.place_rate (
  id                 uuid primary key,
  owner_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  place_id           uuid not null,
  day_type           text not null check (day_type in ('weekday', 'weekend', 'holiday')),
  type               text not null check (type in ('hourly', 'flat')),
  first_minutes      bigint,
  first_sen          bigint,
  block_minutes      bigint,
  block_sen          bigint,
  grace_minutes      bigint not null default 0,
  daily_cap_sen      bigint,
  flat_sen           bigint,
  created_at         bigint not null,
  updated_at         bigint not null,
  deleted_at         bigint,
  server_updated_at  timestamptz not null default now(),
  check (day_type <> 'holiday' or type = 'flat'),
  foreign key (place_id, owner_id) references public.place (id, owner_id)
);

create unique index place_rate_unique
  on public.place_rate (place_id, day_type) where deleted_at is null;

create table public.public_holiday (
  id                 uuid primary key,
  owner_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  holiday_date       date not null,
  name               text,
  created_at         bigint not null,
  updated_at         bigint not null,
  deleted_at         bigint,
  server_updated_at  timestamptz not null default now()
);

create unique index public_holiday_unique
  on public.public_holiday (owner_id, holiday_date) where deleted_at is null;

create table public.parking_session (
  id                 uuid primary key,
  owner_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  vehicle_id         uuid not null,
  place_id           uuid,
  status             text not null check (status in ('active', 'ended')),
  started_at         bigint not null,
  ended_at           bigint,
  level              text,
  bay                text,
  zone_colour_name   text,
  zone_colour_hex    text,
  access_type        text check (access_type in ('lift', 'escalator', 'stairs', 'other')),
  landmark           text,
  note               text,
  rate_snapshot      jsonb,
  timer_ends_at      bigint,
  fee_sen            bigint,
  paid_sen           bigint,
  lat                double precision,
  lng                double precision,
  gps_accuracy_m     double precision,
  created_at         bigint not null,
  updated_at         bigint not null,
  deleted_at         bigint,
  server_updated_at  timestamptz not null default now(),
  foreign key (vehicle_id, owner_id) references public.vehicle (id, owner_id),
  foreign key (place_id, owner_id) references public.place (id, owner_id)
);

create unique index one_active_session_per_vehicle
  on public.parking_session (vehicle_id) where status = 'active' and deleted_at is null;

-- The pull asks each table for the user's rows changed since the last pull.
create index vehicle_pull on public.vehicle (owner_id, server_updated_at);
create index place_pull on public.place (owner_id, server_updated_at);
create index place_rate_pull on public.place_rate (owner_id, server_updated_at);
create index public_holiday_pull on public.public_holiday (owner_id, server_updated_at);
create index parking_session_pull on public.parking_session (owner_id, server_updated_at);

-- Postgres does not index the referencing side of a foreign key by itself.
create index place_rate_place on public.place_rate (place_id, owner_id);
create index parking_session_vehicle on public.parking_session (vehicle_id, owner_id);
create index parking_session_place on public.parking_session (place_id, owner_id);

create trigger set_server_updated_at before insert or update on public.vehicle
  for each row execute function public.set_server_updated_at();
create trigger set_server_updated_at before insert or update on public.place
  for each row execute function public.set_server_updated_at();
create trigger set_server_updated_at before insert or update on public.place_rate
  for each row execute function public.set_server_updated_at();
create trigger set_server_updated_at before insert or update on public.public_holiday
  for each row execute function public.set_server_updated_at();
create trigger set_server_updated_at before insert or update on public.parking_session
  for each row execute function public.set_server_updated_at();

alter table public.vehicle enable row level security;
alter table public.place enable row level security;
alter table public.place_rate enable row level security;
alter table public.public_holiday enable row level security;
alter table public.parking_session enable row level security;

-- Start from no access, then grant what the sync uses. No delete: synced rows
-- are soft-deleted (deleted_at), never deleted (AGENTS.md, "Data"); deleting
-- the account removes them through owner_id. anon gets nothing.
revoke all on public.vehicle, public.place, public.place_rate, public.public_holiday, public.parking_session
  from anon, authenticated;
grant select, insert, update
  on public.vehicle, public.place, public.place_rate, public.public_holiday, public.parking_session
  to authenticated;

-- auth.uid() is wrapped in a select so Postgres reads it once per query, not
-- once per row. The with check stops a row being given to another user.
create policy "Owners use their own cars"
  on public.vehicle for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create policy "Owners use their own places"
  on public.place for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create policy "Owners use their own rates"
  on public.place_rate for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create policy "Owners use their own public holidays"
  on public.public_holiday for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create policy "Owners use their own parking sessions"
  on public.parking_session for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
