-- Harvest Rentals production-oriented Supabase schema.
-- Enable Supabase Auth -> Anonymous Sign-Ins before using the guest login UI.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default 'Guest' check (char_length(full_name) between 1 and 80),
  phone text,
  email text,
  avatar_url text,
  role text check (role in ('farmer','owner')),
  language text not null default 'en' check (language in ('en','kn','hi')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.machines (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  owner_name text not null default 'Machine owner',
  machine_type text not null,
  model_name text,
  price_per_acre numeric(12,2) not null check (price_per_acre > 0 and price_per_acre <= 100000),
  photo_path text not null,
  current_lat double precision,
  current_lng double precision,
  status text not null default 'active' check (status in ('active','paused')),
  crops text[] not null default '{}',
  areas jsonb not null default '[]'::jsonb check (jsonb_typeof(areas) = 'array'),
  pin_hash text not null,
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists machines_owner_idx on public.machines(owner_id, created_at desc) where removed_at is null;
create index if not exists machines_status_idx on public.machines(status, created_at desc) where removed_at is null;
create index if not exists machines_crops_gin_idx on public.machines using gin(crops);

-- Phone numbers are not selectable from the public machine table. They are returned only
-- by the narrowly scoped get_machine_phone() function.
create table if not exists public.machine_contacts (
  machine_id uuid primary key references public.machines(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  phone text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  machine_id uuid not null references public.machines(id) on delete restrict,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  farmer_id uuid not null references public.profiles(id) on delete cascade,
  farmer_name text not null,
  farmer_phone text not null,
  service_date date not null,
  field_village text not null,
  acreage numeric(10,2) not null check (acreage > 0 and acreage <= 5000),
  crop text,
  notes text,
  price_per_acre numeric(12,2) not null,
  status text not null default 'pending' check (status in ('pending','confirmed','rejected','cancelled')),
  request_id text not null,
  machine_type text,
  model_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(farmer_id, request_id)
);
create index if not exists bookings_owner_idx on public.bookings(owner_id, created_at desc);
create index if not exists bookings_farmer_idx on public.bookings(farmer_id, created_at desc);
create index if not exists bookings_machine_date_idx on public.bookings(machine_id, service_date, status);

create table if not exists public.blocked_dates (
  machine_id uuid not null references public.machines(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  created_at timestamptz not null default now(),
  primary key(machine_id, date)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('booking_requested','booking_confirmed','booking_rejected','booking_cancelled','machine_removed')),
  booking_id uuid,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications(user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.machines enable row level security;
alter table public.machine_contacts enable row level security;
alter table public.bookings enable row level security;
alter table public.blocked_dates enable row level security;
alter table public.notifications enable row level security;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.machines to authenticated;
grant select, insert, update on public.machine_contacts to authenticated;
grant select on public.bookings to authenticated;
grant select on public.blocked_dates to authenticated;
grant select, update on public.notifications to authenticated;
grant select on storage.objects to anon, authenticated;
grant insert, update, delete on storage.objects to authenticated;

drop policy if exists "profiles_select_self" on public.profiles;
create policy "profiles_select_self" on public.profiles for select to authenticated using (id = auth.uid());
drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self" on public.profiles for insert to authenticated with check (id = auth.uid());
drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "machines_read_active_or_owned" on public.machines;
create policy "machines_read_active_or_owned" on public.machines for select to authenticated
using ((status = 'active' and removed_at is null) or owner_id = auth.uid());
drop policy if exists "machines_insert_owner" on public.machines;
create policy "machines_insert_owner" on public.machines for insert to authenticated
with check (owner_id = auth.uid() and exists(select 1 from public.profiles p where p.id = auth.uid() and p.role = 'owner'));
drop policy if exists "machines_update_owner" on public.machines;
create policy "machines_update_owner" on public.machines for update to authenticated
using (owner_id = auth.uid() and removed_at is null) with check (owner_id = auth.uid());

-- Contacts are deliberately not directly selectable. Owners can insert/update their own contact row.
drop policy if exists "contacts_owner_select" on public.machine_contacts;
create policy "contacts_owner_select" on public.machine_contacts for select to authenticated using (owner_id = auth.uid());
drop policy if exists "contacts_owner_insert" on public.machine_contacts;
create policy "contacts_owner_insert" on public.machine_contacts for insert to authenticated
with check (owner_id = auth.uid() and exists(select 1 from public.machines m where m.id = machine_id and m.owner_id = auth.uid()));
drop policy if exists "contacts_owner_update" on public.machine_contacts;
create policy "contacts_owner_update" on public.machine_contacts for update to authenticated
using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "bookings_read_participant" on public.bookings;
create policy "bookings_read_participant" on public.bookings for select to authenticated
using (farmer_id = auth.uid() or owner_id = auth.uid());
-- Booking inserts/status changes happen only through security-definer RPCs.

drop policy if exists "blocked_read_authenticated" on public.blocked_dates;
create policy "blocked_read_authenticated" on public.blocked_dates for select to authenticated using (true);
-- blocked-date writes happen only through RPCs.

drop policy if exists "notifications_read_self" on public.notifications;
create policy "notifications_read_self" on public.notifications for select to authenticated using (user_id = auth.uid());
drop policy if exists "notifications_update_self" on public.notifications;
create policy "notifications_update_self" on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
-- Notifications are written by trusted RPCs.

-- Public image URLs are read-only; only a signed-in machine owner can upload/delete within their UUID folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('machine-photos', 'machine-photos', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "machine_photos_public_read" on storage.objects;
create policy "machine_photos_public_read" on storage.objects for select using (bucket_id = 'machine-photos');
drop policy if exists "machine_photos_owner_upload" on storage.objects;
create policy "machine_photos_owner_upload" on storage.objects for insert to authenticated
with check (bucket_id = 'machine-photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "machine_photos_owner_update" on storage.objects;
create policy "machine_photos_owner_update" on storage.objects for update to authenticated
using (bucket_id = 'machine-photos' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'machine-photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "machine_photos_owner_delete" on storage.objects;
create policy "machine_photos_owner_delete" on storage.objects for delete to authenticated
using (bucket_id = 'machine-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create or replace function public.get_machine_busy_dates(p_machine_id uuid)
returns table(date date, reason text)
language plpgsql security definer set search_path = public, extensions as $$
begin
  if auth.uid() is null then raise exception 'ERR_AUTH'; end if;
  if not exists(select 1 from public.machines m where m.id=p_machine_id and m.removed_at is null and (m.status='active' or m.owner_id=auth.uid())) then
    raise exception 'ERR_NOT_FOUND';
  end if;
  return query
    select bd.date, 'blocked'::text from public.blocked_dates bd
      where bd.machine_id=p_machine_id and bd.date >= (now() at time zone 'Asia/Kolkata')::date
    union all
    select b.service_date, 'booked'::text from public.bookings b
      where b.machine_id=p_machine_id and b.status='confirmed' and b.service_date >= (now() at time zone 'Asia/Kolkata')::date;
end; $$;
revoke all on function public.get_machine_busy_dates(uuid) from public;
grant execute on function public.get_machine_busy_dates(uuid) to authenticated;

create or replace function public.get_machine_phone(p_machine_id uuid)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare v_phone text;
begin
  if auth.uid() is null then raise exception 'ERR_AUTH'; end if;
  select c.phone into v_phone from public.machine_contacts c
  join public.machines m on m.id = c.machine_id
  where c.machine_id = p_machine_id and m.removed_at is null and (m.owner_id = auth.uid() or m.status = 'active');
  if v_phone is null then raise exception 'ERR_NOT_FOUND'; end if;
  return v_phone;
end; $$;
revoke all on function public.get_machine_phone(uuid) from public;
grant execute on function public.get_machine_phone(uuid) to authenticated;

create or replace function public.create_machine_booking(
  p_machine_id uuid, p_service_date date, p_field_village text, p_acreage numeric,
  p_crop text, p_phone text, p_notes text, p_request_id text
) returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare
  v_user uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_machine public.machines%rowtype;
  v_booking uuid;
begin
  if v_user is null then raise exception 'ERR_AUTH'; end if;
  select * into v_profile from public.profiles where id = v_user;
  if v_profile.role is distinct from 'farmer' then raise exception 'ERR_NOT_FARMER'; end if;
  if p_service_date < (now() at time zone 'Asia/Kolkata')::date then raise exception 'ERR_PAST_DATE'; end if;
  if length(trim(coalesce(p_field_village,''))) < 2 or p_acreage <= 0 or p_acreage > 5000 or coalesce(p_phone,'') !~ '^\+?[0-9]{10,13}$' then
    raise exception 'ERR_INVALID_INPUT';
  end if;
  select * into v_machine from public.machines where id = p_machine_id and status = 'active' and removed_at is null;
  if not found then raise exception 'ERR_MACHINE_UNAVAILABLE'; end if;
  if v_machine.owner_id = v_user then raise exception 'ERR_OWN_MACHINE'; end if;
  if exists(select 1 from public.blocked_dates where machine_id = p_machine_id and date = p_service_date) then raise exception 'ERR_DATE_BLOCKED'; end if;
  if exists(select 1 from public.bookings where machine_id = p_machine_id and service_date = p_service_date and status = 'confirmed') then raise exception 'ERR_DATE_TAKEN'; end if;
  if exists(select 1 from public.bookings where machine_id = p_machine_id and farmer_id = v_user and service_date = p_service_date and status = 'pending') then
    raise exception 'ERR_DUPLICATE';
  end if;
  select id into v_booking from public.bookings where farmer_id = v_user and request_id = p_request_id;
  if v_booking is not null then return v_booking; end if;
  insert into public.bookings(machine_id, owner_id, farmer_id, farmer_name, farmer_phone, service_date, field_village, acreage, crop, notes, price_per_acre, request_id, machine_type, model_name)
  values(p_machine_id, v_machine.owner_id, v_user, v_profile.full_name, p_phone, p_service_date, trim(p_field_village), p_acreage, p_crop, nullif(trim(coalesce(p_notes,'')),''), v_machine.price_per_acre, p_request_id, v_machine.machine_type, v_machine.model_name)
  on conflict(farmer_id, request_id) do nothing
  returning id into v_booking;
  if v_booking is null then
    select id into v_booking from public.bookings where farmer_id = v_user and request_id = p_request_id;
    return v_booking;
  end if;
  insert into public.notifications(user_id,type,booking_id,data)
  values(v_machine.owner_id,'booking_requested',v_booking,jsonb_build_object('machine_type',v_machine.machine_type,'model_name',v_machine.model_name,'service_date',p_service_date,'farmer_name',v_profile.full_name));
  return v_booking;
end; $$;
revoke all on function public.create_machine_booking(uuid,date,text,numeric,text,text,text,text) from public;
grant execute on function public.create_machine_booking(uuid,date,text,numeric,text,text,text,text) to authenticated;

create or replace function public.respond_to_machine_booking(p_booking_id uuid, p_action text)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare b public.bookings%rowtype; next_status text;
begin
  if p_action not in ('accept','reject') then raise exception 'ERR_INVALID_INPUT'; end if;
  select * into b from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'ERR_NOT_FOUND'; end if;
  if b.owner_id <> auth.uid() then raise exception 'ERR_FORBIDDEN'; end if;
  if b.status <> 'pending' then raise exception 'ERR_INVALID_TRANSITION'; end if;
  perform pg_advisory_xact_lock(hashtext(b.machine_id::text || ':' || b.service_date::text));
  if p_action = 'accept' then
    if b.service_date < (now() at time zone 'Asia/Kolkata')::date then raise exception 'ERR_PAST_DATE'; end if;
    if exists(select 1 from public.blocked_dates where machine_id=b.machine_id and date=b.service_date) then raise exception 'ERR_DATE_BLOCKED'; end if;
    if exists(select 1 from public.bookings where machine_id=b.machine_id and service_date=b.service_date and status='confirmed' and id<>b.id) then raise exception 'ERR_DATE_TAKEN'; end if;
    next_status := 'confirmed';
  else next_status := 'rejected'; end if;
  update public.bookings set status=next_status, updated_at=now() where id=b.id;
  insert into public.notifications(user_id,type,booking_id,data)
  values(b.farmer_id, case when next_status='confirmed' then 'booking_confirmed' else 'booking_rejected' end, b.id,
    jsonb_build_object('machine_type',b.machine_type,'model_name',b.model_name,'service_date',b.service_date));
  return next_status;
end; $$;
revoke all on function public.respond_to_machine_booking(uuid,text) from public;
grant execute on function public.respond_to_machine_booking(uuid,text) to authenticated;

create or replace function public.cancel_machine_booking(p_booking_id uuid)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare b public.bookings%rowtype;
begin
  select * into b from public.bookings where id=p_booking_id for update;
  if not found then raise exception 'ERR_NOT_FOUND'; end if;
  if b.farmer_id <> auth.uid() then raise exception 'ERR_FORBIDDEN'; end if;
  if b.status not in ('pending','confirmed') then raise exception 'ERR_INVALID_TRANSITION'; end if;
  update public.bookings set status='cancelled', updated_at=now() where id=b.id;
  insert into public.notifications(user_id,type,booking_id,data)
  values(b.owner_id,'booking_cancelled',b.id,jsonb_build_object('machine_type',b.machine_type,'model_name',b.model_name,'service_date',b.service_date,'farmer_name',b.farmer_name));
end; $$;
revoke all on function public.cancel_machine_booking(uuid) from public;
grant execute on function public.cancel_machine_booking(uuid) to authenticated;

create or replace function public.block_machine_date(p_machine_id uuid, p_date date)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if p_date < (now() at time zone 'Asia/Kolkata')::date then raise exception 'ERR_PAST_DATE'; end if;
  if not exists(select 1 from public.machines where id=p_machine_id and owner_id=auth.uid() and removed_at is null) then raise exception 'ERR_FORBIDDEN'; end if;
  if exists(select 1 from public.bookings where machine_id=p_machine_id and service_date=p_date and status='confirmed') then raise exception 'ERR_HAS_BOOKING'; end if;
  insert into public.blocked_dates(machine_id,owner_id,date) values(p_machine_id,auth.uid(),p_date);
end; $$;
revoke all on function public.block_machine_date(uuid,date) from public;
grant execute on function public.block_machine_date(uuid,date) to authenticated;

create or replace function public.unblock_machine_date(p_machine_id uuid, p_date date)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not exists(select 1 from public.machines where id=p_machine_id and owner_id=auth.uid() and removed_at is null) then
    raise exception 'ERR_FORBIDDEN';
  end if;
  delete from public.blocked_dates where machine_id=p_machine_id and owner_id=auth.uid() and date=p_date;
end; $$;
revoke all on function public.unblock_machine_date(uuid,date) from public;
grant execute on function public.unblock_machine_date(uuid,date) to authenticated;

create or replace function public.remove_machine(p_machine_id uuid, p_pin text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare m public.machines%rowtype; b record;
begin
  select * into m from public.machines where id=p_machine_id for update;
  if not found then raise exception 'ERR_NOT_FOUND'; end if;
  if m.owner_id <> auth.uid() then raise exception 'ERR_FORBIDDEN'; end if;
  if m.pin_hash <> ('sha256:' || encode(digest(m.id::text || ':' || trim(p_pin), 'sha256'),'hex')) then raise exception 'ERR_WRONG_PIN'; end if;
  for b in update public.bookings set status='cancelled', updated_at=now()
    where machine_id=m.id and status in ('pending','confirmed') returning * loop
    insert into public.notifications(user_id,type,booking_id,data)
    values(b.farmer_id,'machine_removed',b.id,jsonb_build_object('machine_type',m.machine_type,'model_name',m.model_name,'service_date',b.service_date));
  end loop;
  update public.machines set removed_at=now(), status='paused', updated_at=now() where id=m.id;
  delete from public.blocked_dates where machine_id=m.id;
end; $$;
revoke all on function public.remove_machine(uuid,text) from public;
grant execute on function public.remove_machine(uuid,text) to authenticated;

-- Once selected, a demo account cannot change between farmer and owner roles.
create or replace function public.guard_profile_role() returns trigger language plpgsql as $$
begin
  if old.role is not null and new.role is distinct from old.role then
    raise exception 'ERR_ROLE_LOCKED';
  end if;
  return new;
end; $$;
drop trigger if exists profiles_role_guard on public.profiles;
create trigger profiles_role_guard before update on public.profiles for each row execute function public.guard_profile_role();

-- Updated timestamps.
create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists machines_updated_at on public.machines;
create trigger machines_updated_at before update on public.machines for each row execute function public.set_updated_at();
drop trigger if exists bookings_updated_at on public.bookings;
create trigger bookings_updated_at before update on public.bookings for each row execute function public.set_updated_at();

do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    begin alter publication supabase_realtime add table public.bookings; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.notifications; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.machines; exception when duplicate_object then null; end;
  end if;
end $$;
