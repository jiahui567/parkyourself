-- C1: C0's connection check has done its job (the release build downloads the
-- car park list from hosted dev), so anon loses its last test-only access.
-- Its policy goes with the table. Never edit this file once it has been pushed.
drop table public.connection_check;
