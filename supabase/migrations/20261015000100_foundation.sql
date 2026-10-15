-- =============================================================================
-- Phase 1 · File 1 of 5 · Foundation
-- Staff profiles, shop settings, audit log, role helpers, shared trigger functions.
--
-- Security model (applies to every file):
--   * RLS is enabled on every table. No policy = no access (default deny).
--   * Table privileges for `anon` and `authenticated` are revoked first, then
--     only the needed columns are granted back. This is how attendants are
--     stopped from touching columns like stock_units or balance.
--   * Money and stock changes happen only inside SECURITY DEFINER functions
--     (RPCs, added in later phases), which run as the table owner.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Business day: a calendar day in Africa/Accra (UTC+0).
-- -----------------------------------------------------------------------------
create function public.accra_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Africa/Accra')::date
$$;

-- -----------------------------------------------------------------------------
-- profiles: one row per login. New sign-ups have role = null until the owner
-- approves them. Staff are deactivated (is_active = false), never deleted.
-- -----------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  full_name   text not null default '' check (char_length(full_name) <= 120),
  phone       text check (char_length(phone) <= 30),
  role        text check (role in ('owner', 'attendant')),
  is_active   boolean not null default true,
  approved_at timestamptz,
  approved_by uuid references public.profiles (id)
);

comment on table public.profiles is
  'Staff accounts. role null = waiting for owner approval.';

-- -----------------------------------------------------------------------------
-- Role helpers used by RLS policies.
-- SECURITY DEFINER so they can read profiles without hitting profiles' own RLS.
-- A user only counts as staff when their profile is active AND has a role.
-- -----------------------------------------------------------------------------
create function public.current_staff_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.id = (select auth.uid())
    and p.is_active
    and p.role is not null
$$;

create function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_staff_role() = 'owner', false)
$$;

create function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_staff_role() is not null
$$;

-- -----------------------------------------------------------------------------
-- Create a profile automatically when someone signs up.
-- -----------------------------------------------------------------------------
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    left(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), 120),
    nullif(left(btrim(coalesce(new.raw_user_meta_data ->> 'phone', '')), 30), '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- shop_settings: exactly one row (enforced by the `singleton` column).
-- -----------------------------------------------------------------------------
create table public.shop_settings (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  singleton         boolean not null default true unique check (singleton),
  shop_name         text not null default 'Koprice Enterprise'
                      check (char_length(btrim(shop_name)) between 1 and 120),
  phone             text check (char_length(phone) <= 30),
  location          text check (char_length(location) <= 200),
  momo_number       text check (char_length(momo_number) <= 30),
  momo_name         text check (char_length(momo_name) <= 120),
  receipt_footer    text check (char_length(receipt_footer) <= 300),
  currency          text not null default 'GH₵' check (currency = 'GH₵'),
  low_stock_default integer not null default 10 check (low_stock_default >= 0)
);

-- -----------------------------------------------------------------------------
-- audit_logs: insert-only record of sensitive actions.
-- Written by triggers and RPCs only. Owner can read. Nobody can edit or delete.
-- -----------------------------------------------------------------------------
create table public.audit_logs (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id    uuid default auth.uid(),
  action     text not null,
  entity     text not null,
  entity_id  uuid,
  details    jsonb not null default '{}'::jsonb
);

create index audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity, entity_id);

-- -----------------------------------------------------------------------------
-- Shared trigger: write an audit_logs row for insert/update/delete.
-- For updates only the changed columns are stored as {"col": {"old":..,"new":..}}.
-- Trigger arguments = column names to ignore (e.g. 'stock_units', which the
-- stock ledger already records).
-- -----------------------------------------------------------------------------
create function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_row jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  new_row jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  any_row jsonb := coalesce(new_row, old_row);
  ignored text[] := coalesce(tg_argv, '{}'::text[]);
  changes jsonb;
begin
  if tg_op = 'UPDATE' then
    select jsonb_object_agg(n.key, jsonb_build_object('old', old_row -> n.key, 'new', n.value))
      into changes
      from jsonb_each(new_row) as n
     where n.value is distinct from old_row -> n.key
       and not (n.key = any (ignored));

    if changes is null then
      return new; -- nothing worth logging changed
    end if;
  else
    changes := any_row;
  end if;

  insert into public.audit_logs (user_id, action, entity, entity_id, details)
  values (
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    coalesce(any_row ->> 'id', any_row ->> 'product_id')::uuid,
    changes
  );

  return coalesce(new, old);
end;
$$;

-- -----------------------------------------------------------------------------
-- Shared trigger: block changes to permanent records (sales, ledger, logs...).
-- Used as BEFORE UPDATE / DELETE (row) and BEFORE TRUNCATE (statement).
-- -----------------------------------------------------------------------------
create function public.prevent_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% on % is not allowed. These records are permanent; use a status change instead.',
    lower(tg_op), tg_table_name
    using errcode = '42501';
end;
$$;

-- -----------------------------------------------------------------------------
-- Triggers for this file's tables
-- -----------------------------------------------------------------------------
create trigger profiles_audit
  after insert or update on public.profiles
  for each row execute function public.audit_row_change();

create trigger shop_settings_audit
  after update on public.shop_settings
  for each row execute function public.audit_row_change();

create trigger audit_logs_no_update_delete
  before update or delete on public.audit_logs
  for each row execute function public.prevent_change();

create trigger audit_logs_no_truncate
  before truncate on public.audit_logs
  for each statement execute function public.prevent_change();

-- -----------------------------------------------------------------------------
-- Row level security
-- -----------------------------------------------------------------------------
alter table public.profiles      enable row level security;
alter table public.shop_settings enable row level security;
alter table public.audit_logs    enable row level security;

-- profiles: everyone sees their own; owner sees all. Users may edit only their
-- own name/phone (column grant below). Role/approval changes go through an
-- owner-only RPC in phase 2.
create policy "Users see own profile, owner sees all"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_owner()));

create policy "Users update own name and phone"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "Staff read shop settings"
  on public.shop_settings for select to authenticated
  using ((select public.is_staff()));

create policy "Owner updates shop settings"
  on public.shop_settings for update to authenticated
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

create policy "Owner reads audit log"
  on public.audit_logs for select to authenticated
  using ((select public.is_owner()));

-- -----------------------------------------------------------------------------
-- Privileges (column-level where it matters)
-- -----------------------------------------------------------------------------
revoke all on table public.profiles, public.shop_settings, public.audit_logs
  from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

grant select on public.shop_settings to authenticated;
grant update (shop_name, phone, location, momo_number, momo_name, receipt_footer, low_stock_default)
  on public.shop_settings to authenticated;

grant select on public.audit_logs to authenticated;

-- Functions: Supabase grants EXECUTE to anon/authenticated by default; tighten.
revoke all on function public.current_staff_role() from public, anon;
revoke all on function public.is_owner()           from public, anon;
revoke all on function public.is_staff()           from public, anon;
grant execute on function public.current_staff_role() to authenticated;
grant execute on function public.is_owner()           to authenticated;
grant execute on function public.is_staff()           to authenticated;

revoke all on function public.accra_today() from public, anon;
grant execute on function public.accra_today() to authenticated;

revoke all on function public.handle_new_user()  from public, anon, authenticated;
revoke all on function public.audit_row_change() from public, anon, authenticated;
revoke all on function public.prevent_change()   from public, anon, authenticated;
