-- C4: the pull of the sync (PLAN.md, "How the sync works", step 4), and the
-- column the phones' merges use (step 8). Never edit this file once it has
-- been pushed.

-- A place or car the sync merged into another is soft-deleted and names the
-- one it became, so every phone moves its rates and sessions there. The
-- phones merge (decided 2026-10-27); the server only keeps the column. No
-- foreign key: a phone pushes the merged-away row (a deletion, which frees
-- its name) before the row it names, which may not be on the server yet.
alter table public.place add column merged_into uuid;
alter table public.vehicle add column merged_into uuid;

-- The signed-in user's rows of one synced table changed after a point,
-- deleted ones too, oldest change first: [row, ...], each with the phone's
-- columns and server_updated_us, its server_updated_at in whole microseconds
-- since 1970 (exact in a JavaScript number, so the phone can step back by the
-- pull's overlap without parsing a timestamp). The point is (p_after_us,
-- p_after_id): rows stamped later, or stamped the same with a larger id; no
-- p_after_id means every row stamped later, and no p_after_us every row. The
-- id matters because every row of one push shares its transaction's stamp,
-- so a page can end among them.
create function public.pull_synced_rows(p_table text, p_after_us bigint, p_after_id uuid, p_limit integer)
returns jsonb
language plpgsql
stable
-- The caller's own rights, so Row Level Security gives only their own rows.
security invoker
set search_path = ''
as $$
declare
  v_after timestamptz;
  v_rows jsonb;
begin
  -- The table name goes into the SQL text below, so only these five.
  if p_table not in ('vehicle', 'place', 'place_rate', 'public_holiday', 'parking_session') then
    raise exception 'Not a synced table: %', p_table;
  end if;
  -- Added as an interval, not through to_timestamp, which takes a double and
  -- would round the microseconds.
  v_after := timestamptz 'epoch' + p_after_us * interval '1 microsecond';

  execute format(
    'select coalesce(jsonb_agg(r.data order by r.stamp, r.id), ''[]''::jsonb) from ('
    '  select to_jsonb(t) - ''owner_id'' - ''server_updated_at'''
    '      || jsonb_build_object(''server_updated_us'', (extract(epoch from t.server_updated_at) * 1000000)::bigint)'
    '      as data,'
    '    t.server_updated_at as stamp, t.id'
    '  from public.%I t'
    '  where $1 is null'
    '    or (t.server_updated_at, t.id) > ($1, coalesce($2, ''ffffffff-ffff-ffff-ffff-ffffffffffff''::uuid))'
    '  order by t.server_updated_at, t.id'
    '  limit $3'
    ') r',
    p_table
  ) into v_rows using v_after, p_after_id, least(greatest(coalesce(p_limit, 200), 1), 1000);
  return v_rows;
end;
$$;

revoke execute on function public.pull_synced_rows(text, bigint, uuid, integer) from public, anon;
grant execute on function public.pull_synced_rows(text, bigint, uuid, integer) to authenticated;
