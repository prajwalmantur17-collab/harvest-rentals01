-- Run after applying the migration in Supabase SQL Editor.
-- This is a schema/configuration smoke test, not a substitute for multi-user integration tests.
do $$
declare
  missing text;
begin
  select string_agg(required_name, ', ')
  into missing
  from (values
    ('profiles'), ('machines'), ('machine_contacts'), ('bookings'),
    ('blocked_dates'), ('notifications')
  ) as required(required_name)
  where to_regclass('public.' || required_name) is null;

  if missing is not null then
    raise exception 'Missing required tables: %', missing;
  end if;

  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='get_machine_busy_dates') then
    raise exception 'Missing RPC: get_machine_busy_dates';
  end if;
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='create_machine_booking') then
    raise exception 'Missing RPC: create_machine_booking';
  end if;
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='respond_to_machine_booking') then
    raise exception 'Missing RPC: respond_to_machine_booking';
  end if;
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='cancel_machine_booking') then
    raise exception 'Missing RPC: cancel_machine_booking';
  end if;
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='unblock_machine_date') then
    raise exception 'Missing RPC: unblock_machine_date';
  end if;
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='remove_machine') then
    raise exception 'Missing RPC: remove_machine';
  end if;

  if not exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='machines' and c.relrowsecurity) then
    raise exception 'RLS is not enabled on public.machines';
  end if;
  if not exists (select 1 from storage.buckets where id='machine-photos') then
    raise exception 'Missing storage bucket: machine-photos';
  end if;
end $$;

select 'Harvest Rentals schema smoke test passed' as result;
