-- =============================================================================
-- Phase 2 · Staff administration
--   list_staff()                           owner: everyone with their email
--   update_staff_access(user, role, active) owner: approve, change role,
--                                            turn access off/on
-- Changes to profiles are written to audit_logs by the profiles_audit trigger.
-- =============================================================================

create function public.list_staff()
returns table (
  id              uuid,
  email           text,
  full_name       text,
  phone           text,
  role            text,
  is_active       boolean,
  created_at      timestamptz,
  approved_at     timestamptz,
  last_sign_in_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not public.is_owner() then
    raise exception 'Only the owner can view staff' using errcode = '42501';
  end if;

  return query
    select p.id, u.email::text, p.full_name, p.phone, p.role, p.is_active,
           p.created_at, p.approved_at, u.last_sign_in_at
      from public.profiles p
      join auth.users u on u.id = p.id
     order by p.created_at;
end;
$$;

create function public.update_staff_access(
  p_user_id   uuid,
  p_role      text,
  p_is_active boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := auth.uid();
  target public.profiles;
begin
  if not public.is_owner() then
    raise exception 'Only the owner can change staff access' using errcode = '42501';
  end if;

  if p_role is null or p_role not in ('owner', 'attendant') then
    raise exception 'Role must be owner or attendant' using errcode = '22023';
  end if;

  if p_is_active is null then
    raise exception 'Active must be true or false' using errcode = '22023';
  end if;

  select * into target from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'Staff member not found' using errcode = 'P0002';
  end if;

  -- The caller is an active owner, so blocking self-demotion also guarantees
  -- the shop always keeps at least one owner.
  if p_user_id = me and (p_role <> 'owner' or not p_is_active) then
    raise exception 'You cannot remove your own owner access' using errcode = '42501';
  end if;

  update public.profiles
     set role        = p_role,
         is_active   = p_is_active,
         approved_at = case when target.role is null then now() else approved_at end,
         approved_by = case when target.role is null then me else approved_by end
   where id = p_user_id;
end;
$$;

revoke all on function public.list_staff() from public, anon;
revoke all on function public.update_staff_access(uuid, text, boolean) from public, anon;
grant execute on function public.list_staff() to authenticated;
grant execute on function public.update_staff_access(uuid, text, boolean) to authenticated;

-- -----------------------------------------------------------------------------
-- Supabase creates public.rls_auto_enable() in new projects (an event-trigger
-- helper). The security advisor flags it as callable through the API.
-- Nobody needs to call it directly, so remove EXECUTE from API roles.
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from pg_proc
     where proname = 'rls_auto_enable'
       and pronamespace = 'public'::regnamespace
  ) then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end;
$$;
