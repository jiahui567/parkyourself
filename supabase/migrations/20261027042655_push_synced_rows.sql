-- C3: the push of the sync (PLAN.md, "How the sync works", step 3). The phone
-- sends the rows of one synced table whose latest change has not reached the
-- server, oldest change first. Each row is added, or replaces the server's
-- row when it is newer (last write wins, by updated_at, the phone's clock).
-- A row that breaks a rule is refused on its own and the others still go in,
-- so one clash never holds back the rest of the phone's changes. Never edit
-- this file once it has been pushed.
--
-- Returns the refused rows: [{ id, code, constraint, other }], code being the
-- SQLSTATE. other is the server's active session for the car when the row is
-- a second one (one_active_session_per_vehicle): two active sessions for one
-- car are never merged, and the phone asks the user to end one (PLAN.md,
-- step 8).
create function public.push_synced_rows(p_table text, p_rows jsonb)
returns jsonb
language plpgsql
-- The caller's own rights, so Row Level Security decides as it does for any
-- write: a row is added only for the signed-in user, and another user's row
-- with the same id is never changed. Sent newer, it is refused (42501); sent
-- older, it is skipped like any older change, since the newer-row check comes
-- before the policy check.
security invoker
set search_path = ''
as $$
declare
  v_row jsonb;
  v_columns text;
  v_updates text;
  v_constraint text;
  v_other jsonb;
  v_refused jsonb := '[]'::jsonb;
begin
  -- The table name goes into the SQL text below, so only these five.
  if p_table not in ('vehicle', 'place', 'place_rate', 'public_holiday', 'parking_session') then
    raise exception 'Not a synced table: %', p_table;
  end if;
  if jsonb_typeof(p_rows) is distinct from 'array' then
    raise exception 'p_rows must be a JSON array';
  end if;

  for v_row in select value from jsonb_array_elements(p_rows) loop
    -- Only the columns the phone sent, so a phone on an older app version
    -- never blanks a column it does not know (PLAN.md, "Changing the schema
    -- in two databases"). owner_id and server_updated_at are the server's.
    select
      string_agg(format('%I', a.attname), ', ' order by a.attnum),
      string_agg(format('%1$I = excluded.%1$I', a.attname), ', ' order by a.attnum) filter (where a.attname <> 'id')
    into v_columns, v_updates
    from pg_catalog.pg_attribute a
    where a.attrelid = format('public.%I', p_table)::regclass
      and a.attnum > 0
      and not a.attisdropped
      and a.attname not in ('owner_id', 'server_updated_at')
      and v_row ? a.attname;

    -- Each row in its own block, so a refused one is undone alone. The
    -- unique rules are checked row by row, which is why the phone sends a
    -- row that frees a name before the one that takes it.
    begin
      -- A row with no column to change (or no column known at all) would
      -- make the statement below invalid: refuse it like a bad value.
      if v_updates is null then
        raise sqlstate '22023' using message = 'The row has no column to change';
      end if;
      execute format(
        'insert into public.%1$I as t (%2$s) select %2$s from jsonb_populate_record(null::public.%1$I, $1) '
        'on conflict (id) do update set %3$s where excluded.updated_at > t.updated_at',
        p_table, v_columns, v_updates
      ) using v_row;
    -- A broken rule (class 23), a value the column cannot take (class 22: a
    -- bad uuid, date or number) or another user's row. Anything else is a
    -- fault of the server and fails the whole push, to be tried again later.
    exception
      when integrity_constraint_violation or data_exception or insufficient_privilege then
        get stacked diagnostics v_constraint = constraint_name;
        v_other := null;
        if v_constraint = 'one_active_session_per_vehicle' then
          select jsonb_build_object('id', s.id, 'level', s.level, 'bay', s.bay, 'started_at', s.started_at)
          into v_other
          from public.parking_session s
          where s.vehicle_id = (v_row ->> 'vehicle_id')::uuid
            and s.status = 'active'
            and s.deleted_at is null;
        end if;
        v_refused := v_refused || jsonb_build_array(jsonb_build_object(
          'id', v_row ->> 'id',
          'code', sqlstate,
          'constraint', nullif(v_constraint, ''),
          'other', v_other
        ));
    end;
  end loop;

  return v_refused;
end;
$$;

revoke execute on function public.push_synced_rows(text, jsonb) from public, anon;
grant execute on function public.push_synced_rows(text, jsonb) to authenticated;
