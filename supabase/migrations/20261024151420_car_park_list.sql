-- M12: the public car park list. Anyone may read it (the app downloads it
-- once a day, signed out); only migrations write it. Its data comes from
-- src/carparks/carParkList.json through `npm run carparks:sql`, never from
-- the dashboard. Never edit this file once it has been pushed.
create table public.car_park (
  id          text primary key,                   -- stable slug, 'sunway-pyramid'
  name        text not null,
  area        text,
  lat         double precision,
  lng         double precision,
  source_url  text not null,
  checked_on  date not null,
  notes       text,
  updated_at  timestamptz not null default now()
);

-- Rate history: a change adds rows with a later effective_from and keeps the
-- old ones. effective_from null means "since before it was first checked".
-- The fee columns match the app's place_rate, money in sen.
create table public.car_park_rate (
  id              bigint generated always as identity primary key,
  car_park_id     text not null references public.car_park (id) on delete cascade,
  day_type        text not null check (day_type in ('weekday', 'weekend', 'holiday')),
  effective_from  date,
  type            text not null check (type in ('hourly', 'flat')),
  first_minutes   integer,
  first_sen       integer,
  block_minutes   integer,
  block_sen       integer,
  grace_minutes   integer not null default 0,
  daily_cap_sen   integer,
  flat_sen        integer,
  check (day_type <> 'holiday' or type = 'flat')
);

create unique index car_park_rate_unique
  on public.car_park_rate (car_park_id, day_type, coalesce(effective_from, '-infinity'::date));

alter table public.car_park enable row level security;
alter table public.car_park_rate enable row level security;

-- Start from no access, then allow reading only. The list is public reference
-- data, the second exception to "anon gets nothing" (PLAN.md, M12).
revoke all on public.car_park, public.car_park_rate from anon, authenticated;
grant select on public.car_park, public.car_park_rate to anon, authenticated;

create policy "Anyone can read the car park list"
  on public.car_park for select to anon, authenticated using (true);

create policy "Anyone can read the car park rates"
  on public.car_park_rate for select to anon, authenticated using (true);
