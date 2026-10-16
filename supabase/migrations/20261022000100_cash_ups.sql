-- =============================================================================
-- Phase 8 · My day and cash-up
--   day_totals(attendant, date)      internal: money one attendant took in a day
--   my_day(date)                     staff: own totals, sales list, cash-up status
--   submit_cash_up(...)              staff: close the day (expected figures computed here)
--   confirm_cash_up(id, amount, note) owner: count the money, record any shortage
-- Business day = calendar day in Africa/Accra.
-- Counted sales: completed and refunded (money was taken). Cancelled (void)
-- and held sales are not counted.
-- =============================================================================

create function public.day_totals(p_attendant uuid, p_date date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with s as (
    select * from public.sales
     where attendant_id = p_attendant
       and (created_at at time zone 'Africa/Accra')::date = p_date
  ),
  r as (
    select * from public.credit_payments
     where received_by = p_attendant
       and status = 'completed'
       and (created_at at time zone 'Africa/Accra')::date = p_date
  ),
  t as (
    select
      count(*) filter (where s.status in ('completed', 'refunded'))                          as sales_count,
      coalesce(sum(s.total) filter (where s.status in ('completed', 'refunded')), 0)          as sales_total,
      coalesce(sum(s.paid_cash - s.change_given) filter (where s.status in ('completed', 'refunded')), 0) as cash_sales,
      coalesce(sum(s.paid_momo) filter (where s.status in ('completed', 'refunded')), 0)      as momo_sales,
      coalesce(sum(s.credit_amount) filter (where s.status in ('completed', 'refunded')), 0)  as credit_given,
      coalesce(sum(s.discount) filter (where s.status in ('completed', 'refunded')), 0)       as discounts,
      count(*) filter (where s.status = 'held_for_approval')                                 as held_count,
      count(*) filter (where s.status = 'void')                                              as void_count
    from s
  ),
  rp as (
    select coalesce(sum(amount) filter (where method = 'cash'), 0) as repaid_cash,
           coalesce(sum(amount) filter (where method = 'momo'), 0) as repaid_momo,
           count(*) as repayments_count
      from r
  )
  select jsonb_build_object(
    'business_date',    p_date,
    'sales_count',      t.sales_count,
    'sales_total',      t.sales_total,
    'cash_sales',       t.cash_sales,
    'momo_sales',       t.momo_sales,
    'credit_given',     t.credit_given,
    'discounts',        t.discounts,
    'held_count',       t.held_count,
    'void_count',       t.void_count,
    'repaid_cash',      rp.repaid_cash,
    'repaid_momo',      rp.repaid_momo,
    'repayments_count', rp.repayments_count,
    'expected_cash',    t.cash_sales + rp.repaid_cash,
    'expected_momo',    t.momo_sales + rp.repaid_momo)
  from t, rp
$$;

create function public.my_day(p_date date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me   uuid := auth.uid();
  v_date date := coalesce(p_date, public.accra_today());
begin
  if not public.is_staff() then
    raise exception 'Only approved staff' using errcode = '42501';
  end if;
  return public.day_totals(v_me, v_date) || jsonb_build_object(
    'cash_up', (select to_jsonb(c) - 'attendant_id' from public.cash_ups c
                 where c.attendant_id = v_me and c.business_date = v_date),
    'sales', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', s.id, 'receipt_no', s.receipt_no, 'created_at', s.created_at,
               'total', s.total, 'status', s.status,
               'paid_cash', s.paid_cash - s.change_given, 'paid_momo', s.paid_momo,
               'credit_amount', s.credit_amount,
               'customer', (select c.name from public.customers c where c.id = s.customer_id))
             order by s.created_at desc)
        from public.sales s
       where s.attendant_id = v_me
         and (s.created_at at time zone 'Africa/Accra')::date = v_date), '[]'::jsonb));
end;
$$;

create function public.submit_cash_up(
  p_business_date date,
  p_method        text,
  p_amount        numeric,
  p_momo_txn_id   text default null,
  p_note          text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me     uuid := auth.uid();
  v_date   date := coalesce(p_business_date, public.accra_today());
  v_totals jsonb;
  v_row    public.cash_ups;
begin
  if not public.is_staff() then
    raise exception 'Only approved staff can close a day' using errcode = '42501';
  end if;
  if v_date > public.accra_today() or v_date < public.accra_today() - 7 then
    raise exception 'You can only close today or the last 7 days' using errcode = '22023';
  end if;
  if p_method is null or p_method not in ('momo', 'safe') then
    raise exception 'Choose how you are handing over the cash' using errcode = '22023';
  end if;
  if p_amount is null or p_amount < 0 then
    raise exception 'Enter the amount you are handing over' using errcode = '22023';
  end if;
  if exists (select 1 from public.cash_ups where attendant_id = v_me and business_date = v_date) then
    raise exception 'You have already closed this day' using errcode = '23505';
  end if;

  v_totals := public.day_totals(v_me, v_date);

  insert into public.cash_ups (
    attendant_id, business_date, expected_cash, expected_momo, credit_given,
    handover_method, amount_handed, momo_txn_id, note)
  values (
    v_me, v_date,
    (v_totals ->> 'expected_cash')::numeric,
    (v_totals ->> 'expected_momo')::numeric,
    (v_totals ->> 'credit_given')::numeric,
    p_method, round(p_amount, 2), nullif(btrim(p_momo_txn_id), ''), nullif(btrim(p_note), ''))
  returning * into v_row;

  return to_jsonb(v_row);
end;
$$;

create function public.confirm_cash_up(p_cash_up_id uuid, p_confirmed_amount numeric, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.cash_ups;
begin
  if not public.is_owner() then
    raise exception 'Only the owner can confirm cash-ups' using errcode = '42501';
  end if;
  if p_confirmed_amount is null or p_confirmed_amount < 0 then
    raise exception 'Enter the amount you received' using errcode = '22023';
  end if;
  select * into v_row from public.cash_ups where id = p_cash_up_id for update;
  if not found then
    raise exception 'Cash-up not found' using errcode = 'P0002';
  end if;
  if v_row.status <> 'submitted' then
    raise exception 'This cash-up was already checked' using errcode = '22023';
  end if;

  update public.cash_ups
     set confirmed_amount = round(p_confirmed_amount, 2),
         confirmed_by     = auth.uid(),
         confirmed_at     = now(),
         status           = case when round(p_confirmed_amount, 2) < expected_cash then 'short' else 'confirmed' end,
         note             = concat_ws(E'\n', note, case when nullif(btrim(p_note), '') is not null
                                                     then 'Owner: ' || btrim(p_note) end)
   where id = p_cash_up_id
  returning * into v_row;

  insert into public.audit_logs (action, entity, entity_id, details)
  values ('cash_up_' || v_row.status, 'cash_ups', v_row.id,
          jsonb_build_object('attendant_id', v_row.attendant_id, 'business_date', v_row.business_date,
                             'expected_cash', v_row.expected_cash, 'confirmed_amount', v_row.confirmed_amount,
                             'shortage', v_row.shortage, 'note', p_note));

  return to_jsonb(v_row);
end;
$$;

-- Owner: the day of any attendant (for checking a cash-up).
create function public.attendant_day(p_attendant uuid, p_date date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_owner() then
    raise exception 'Only the owner' using errcode = '42501';
  end if;
  return public.day_totals(p_attendant, p_date);
end;
$$;

revoke all on function public.day_totals(uuid, date) from public, anon, authenticated;
revoke all on function public.my_day(date) from public, anon;
revoke all on function public.submit_cash_up(date, text, numeric, text, text) from public, anon;
revoke all on function public.confirm_cash_up(uuid, numeric, text) from public, anon;
revoke all on function public.attendant_day(uuid, date) from public, anon;
grant execute on function public.my_day(date) to authenticated;
grant execute on function public.submit_cash_up(date, text, numeric, text, text) to authenticated;
grant execute on function public.confirm_cash_up(uuid, numeric, text) to authenticated;
grant execute on function public.attendant_day(uuid, date) to authenticated;
