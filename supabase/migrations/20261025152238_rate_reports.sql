-- C10: rate reports. A user signed in with an email reports a rate change for
-- a car park on the list, or suggests one that is not on it, with an optional
-- photo of the rate board. The developer reviews each report in Studio; an
-- approved one reaches the list through src/carparks/carParkList.json and
-- `npm run carparks:sql`, so the list keeps one source. Reports come from
-- anyone, so the server checks everything itself and limits how much one user
-- can send. Never edit this file once it has been pushed.

-- A number in a report's rates: a whole number from low to high, or, when not
-- required, missing or null.
create function public.report_number_ok(value jsonb, low integer, high integer, required boolean)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when value is null or jsonb_typeof(value) = 'null' then not required
    when jsonb_typeof(value) = 'number' then value::numeric between low and high and value::numeric = trunc(value::numeric)
    else false
  end;
$$;

-- One day type's rate in a report: null, or the app's place_rate fee fields
-- with the same rules as the phone (src/fees/calcFee.js, assertValidRate),
-- plus upper limits (a day, RM 1,000) so an absurd number never shows to other
-- users while the report waits. The phone checks the same before sending
-- (src/carparks/reports.js).
create function public.report_rate_is_valid(rate jsonb, day_type text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when rate is null or jsonb_typeof(rate) = 'null' then true
    when jsonb_typeof(rate) <> 'object' then false
    else rate - array['type', 'first_minutes', 'first_sen', 'block_minutes', 'block_sen',
                      'grace_minutes', 'daily_cap_sen', 'flat_sen'] = '{}'::jsonb
      and coalesce(rate ->> 'type' in ('hourly', 'flat'), false)
      and (rate ->> 'type' = 'flat' or day_type <> 'holiday')
      and public.report_number_ok(rate -> 'first_minutes', 1, 1440, rate ->> 'type' = 'hourly')
      and public.report_number_ok(rate -> 'first_sen', 0, 100000, rate ->> 'type' = 'hourly')
      and public.report_number_ok(rate -> 'block_minutes', 1, 1440, rate ->> 'type' = 'hourly')
      and public.report_number_ok(rate -> 'block_sen', 0, 100000, rate ->> 'type' = 'hourly')
      and public.report_number_ok(rate -> 'flat_sen', 0, 100000, rate ->> 'type' = 'flat')
      and public.report_number_ok(rate -> 'grace_minutes', 0, 1440, false)
      and public.report_number_ok(rate -> 'daily_cap_sen', 1, 100000, false)
  end;
$$;

create table public.rate_report (
  -- Made by the phone, so the report can name its photo before uploading it.
  id           uuid primary key default gen_random_uuid(),
  reporter_id  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- A car park on the list, or the name (and location, if known) of a new one.
  car_park_id  text references public.car_park (id) on delete cascade,
  name         text,
  lat          double precision,
  lng          double precision,
  -- { weekday, weekend, holiday }, each null or a rate (report_rate_is_valid).
  rates        jsonb not null,
  note         text,
  -- '<reporter_id>/<id>.jpg' in the report-photos bucket, uploaded just
  -- after the report (a failed upload leaves a report without its photo).
  photo_path   text,
  status       text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at   timestamptz not null default now(),
  reviewed_at  timestamptz,
  check ((car_park_id is null) <> (name is null)),
  check (name is null or (char_length(name) between 1 and 100 and name = btrim(name))),
  check (note is null or char_length(note) <= 500),
  check ((lat is null) = (lng is null)),
  check (lat is null or (lat between -90 and 90 and lng between -180 and 180)),
  check (jsonb_typeof(rates) = 'object' and rates - array['weekday', 'weekend', 'holiday'] = '{}'::jsonb),
  check (jsonb_strip_nulls(rates) <> '{}'::jsonb),
  check (public.report_rate_is_valid(rates -> 'weekday', 'weekday')
    and public.report_rate_is_valid(rates -> 'weekend', 'weekend')
    and public.report_rate_is_valid(rates -> 'holiday', 'holiday')),
  check (photo_path is null or photo_path = reporter_id::text || '/' || id::text || '.jpg')
);

-- One report waiting per user and car park: a second one is a resend or spam.
create unique index rate_report_one_pending_per_car_park
  on public.rate_report (reporter_id, car_park_id) where status = 'pending' and car_park_id is not null;
create unique index rate_report_one_pending_per_new_name
  on public.rate_report (reporter_id, lower(name)) where status = 'pending' and car_park_id is null;
-- The daily download of pending reports, and a user's own reports (also the
-- foreign key's index for deleting an account).
create index rate_report_pending on public.rate_report (car_park_id) where status = 'pending';
create index rate_report_reporter on public.rate_report (reporter_id, created_at);

-- At most 5 reports a day per user. Runs as the user, so it counts only the
-- rows that user can read: their own. The lock makes one user's inserts wait
-- for each other: without it, requests sent at the same moment would each
-- count only the reports already committed, and all get in.
create function public.limit_rate_reports()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('rate_report:' || new.reporter_id::text, 0));
  if (select count(*) from public.rate_report
      where reporter_id = new.reporter_id and created_at > now() - interval '1 day') >= 5 then
    raise exception 'You can send at most 5 reports a day. Try again tomorrow.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- When the developer approves or rejects a report in Studio.
create function public.stamp_rate_report_review()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    new.reviewed_at := now();
  end if;
  return new;
end;
$$;

create trigger limit_rate_reports before insert on public.rate_report
  for each row execute function public.limit_rate_reports();
create trigger stamp_rate_report_review before update on public.rate_report
  for each row execute function public.stamp_rate_report_review();

alter table public.rate_report enable row level security;

revoke all on public.rate_report from anon, authenticated;
-- Signed in: send a report, with the server filling in who sent it, its
-- status and its time, and read your own.
grant insert (id, car_park_id, name, lat, lng, rates, note, photo_path) on public.rate_report to authenticated;
grant select on public.rate_report to authenticated;
-- Signed out (the daily download): what a pending report says about a listed
-- car park, never who sent it, its note or its photo. A suggested new car park
-- stays private until it is approved: its name is free text from a stranger.
grant select (id, car_park_id, rates, created_at) on public.rate_report to anon;

-- Check constraints run their functions as the user who inserts.
revoke execute on function public.report_number_ok(jsonb, integer, integer, boolean) from public, anon;
revoke execute on function public.report_rate_is_valid(jsonb, text) from public, anon;
grant execute on function public.report_number_ok(jsonb, integer, integer, boolean) to authenticated;
grant execute on function public.report_rate_is_valid(jsonb, text) to authenticated;
revoke execute on function public.limit_rate_reports() from public, anon, authenticated;
revoke execute on function public.stamp_rate_report_review() from public, anon, authenticated;

-- Anonymous sign-ins are off (PLAN.md, C10: reports need an email), but a
-- token can still say is_anonymous if they are ever turned on for sync.
create policy "Email users send reports as themselves"
  on public.rate_report for insert to authenticated
  with check (
    reporter_id = (select auth.uid())
    and (select (auth.jwt() ->> 'is_anonymous')::boolean) is not true
  );

create policy "Users read their own reports"
  on public.rate_report for select to authenticated
  using (reporter_id = (select auth.uid()));

create policy "Anyone reads pending reports about listed car parks"
  on public.rate_report for select to anon
  using (status = 'pending' and car_park_id is not null);

-- The rate board photos: private, only the developer looks at them (in
-- Studio). One JPEG of at most 2 MB per report, shrunk by the phone first.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('report-photos', 'report-photos', false, 2097152, array['image/jpeg']);

-- A photo only for the user's own report that waits for review and names it
-- (photo_path, '<their id>/<report id>.jpg'): the report goes first, so there
-- is one photo per report at most, and the report limit (5 a day) limits
-- photos too. No photo can be stored without a report.
create policy "Users upload the photo their pending report names"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'report-photos'
    -- objects.name, not name: rate_report has a name column too.
    and exists (
      select 1 from public.rate_report r
      where r.photo_path = objects.name and r.reporter_id = (select auth.uid()) and r.status = 'pending'
    )
  );

-- Reading and deleting their own: deleting an account removes them all first
-- (delete_my_account).
create policy "Users read their own report photos"
  on storage.objects for select to authenticated
  using (bucket_id = 'report-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users delete their own report photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'report-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Deletes the signed-in user's account. The foreign keys on auth.users delete
-- their reports and synced rows with it. Photos are files the Storage API
-- must delete, which SQL cannot do, so the app deletes them first and this
-- refuses while any are left, rather than leave files nobody owns.
create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from storage.objects
    where bucket_id = 'report-photos' and (storage.foldername(name))[1] = (select auth.uid())::text
  ) then
    raise exception 'Delete your report photos first.' using errcode = 'P0001';
  end if;
  delete from auth.users where id = (select auth.uid());
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
