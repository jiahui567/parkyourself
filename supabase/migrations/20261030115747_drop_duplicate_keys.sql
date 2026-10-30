-- 2026-10-30: vehicle and place kept their unique (id, owner_id) when it
-- became their primary key too (20261028014940), so each had two identical
-- indexes, both written on every change. The foreign keys that pointed at the
-- unique ones now point at the primary keys, under the same names, and the
-- unique ones go. Never edit this file once it has been pushed.

alter table public.place_rate drop constraint place_rate_place_id_owner_id_fkey;
alter table public.parking_session
  drop constraint parking_session_vehicle_id_owner_id_fkey,
  drop constraint parking_session_place_id_owner_id_fkey;

alter table public.vehicle drop constraint vehicle_id_owner_id_key;
alter table public.place drop constraint place_id_owner_id_key;

alter table public.place_rate
  add constraint place_rate_place_id_owner_id_fkey
    foreign key (place_id, owner_id) references public.place (id, owner_id);
alter table public.parking_session
  add constraint parking_session_vehicle_id_owner_id_fkey
    foreign key (vehicle_id, owner_id) references public.vehicle (id, owner_id),
  add constraint parking_session_place_id_owner_id_fkey
    foreign key (place_id, owner_id) references public.place (id, owner_id);
