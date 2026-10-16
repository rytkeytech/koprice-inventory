-- =============================================================================
-- Phase 11 · Expenses
-- The owner confirms or rejects expenses by changing their status (allowed by
-- RLS for the owner only). This trigger stamps who decided and when, so it
-- can't be typed in or faked from the app.
-- =============================================================================

create function public.stamp_expense_decision()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status in ('confirmed', 'rejected')
     and (tg_op = 'INSERT' or new.status is distinct from old.status) then
    new.confirmed_by := auth.uid();
    new.confirmed_at := now();
  elsif new.status = 'pending' then
    new.confirmed_by := null;
    new.confirmed_at := null;
  end if;
  return new;
end;
$$;

create trigger expenses_stamp_decision
  before insert or update on public.expenses
  for each row execute function public.stamp_expense_decision();

revoke all on function public.stamp_expense_decision() from public, anon, authenticated;
