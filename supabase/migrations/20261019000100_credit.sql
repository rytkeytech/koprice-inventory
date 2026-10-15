-- =============================================================================
-- Phase 5 · Customers and credit
--   record_credit_payment(...)   staff: customer pays back credit
--   customer_statement(id)       owner: credit sales and payments, running balance
--   debtors()                    owner: everyone who owes, with days owed
-- =============================================================================

create function public.record_credit_payment(
  p_customer_id uuid,
  p_amount      numeric,
  p_method      text,
  p_momo_txn_id text default null,
  p_note        text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer public.customers;
  v_amount   numeric(12,2) := round(coalesce(p_amount, 0), 2);
  v_txn      text := nullif(btrim(p_momo_txn_id), '');
  v_id       uuid;
begin
  if not public.is_staff() then
    raise exception 'Only approved staff can record payments' using errcode = '42501';
  end if;
  if p_method is null or p_method not in ('cash', 'momo') then
    raise exception 'Choose cash or MoMo' using errcode = '22023';
  end if;
  if v_amount <= 0 then
    raise exception 'Enter the amount paid' using errcode = '22023';
  end if;
  if p_method = 'momo' and v_txn is null then
    raise exception 'Enter the MoMo transaction ID' using errcode = '22023';
  end if;

  select * into v_customer from public.customers where id = p_customer_id for update;
  if not found then
    raise exception 'Customer not found' using errcode = 'P0002';
  end if;
  if v_amount > v_customer.balance then
    raise exception '% only owes GH₵ %', v_customer.name, to_char(v_customer.balance, 'FM999999990.00')
      using errcode = '22023';
  end if;

  insert into public.credit_payments (customer_id, amount, method, momo_txn_id, note)
  values (p_customer_id, v_amount, p_method, v_txn, nullif(btrim(p_note), ''))
  returning id into v_id;

  update public.customers set balance = balance - v_amount where id = p_customer_id;

  insert into public.audit_logs (action, entity, entity_id, details)
  values ('credit_payment', 'customers', p_customer_id,
          jsonb_build_object('amount', v_amount, 'method', p_method, 'payment_id', v_id,
                             'balance_before', v_customer.balance, 'balance_after', v_customer.balance - v_amount));

  return jsonb_build_object(
    'payment_id', v_id,
    'customer_name', v_customer.name,
    'amount', v_amount,
    'balance', v_customer.balance - v_amount);
end;
$$;

-- Statement lines, oldest first, with the balance after each line.
-- debit = customer owes more; credit = customer owes less.
create function public.customer_statement(p_customer_id uuid)
returns table (
  happened_at timestamptz,
  kind        text,
  reference   text,
  description text,
  debit       numeric,
  credit      numeric,
  balance     numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not public.is_owner() then
    raise exception 'Only the owner can view statements' using errcode = '42501';
  end if;

  return query
    with lines as (
      select s.created_at as happened_at, 'sale'::text as kind, s.receipt_no as reference,
             'Credit sale' || coalesce(' by ' || split_part(pr.full_name, ' ', 1), '') as description,
             s.credit_amount as debit, 0::numeric as credit
        from public.sales s
        left join public.profiles pr on pr.id = s.attendant_id
       where s.customer_id = p_customer_id
         and s.credit_amount > 0
         and s.status in ('completed', 'refunded', 'void')
      union all
      select cp.created_at, 'payment', null,
             'Paid by ' || case cp.method when 'momo' then 'MoMo' || coalesce(' ' || cp.momo_txn_id, '') else 'cash' end,
             0, cp.amount
        from public.credit_payments cp
       where cp.customer_id = p_customer_id and cp.status = 'completed'
    )
    select l.happened_at, l.kind, l.reference, l.description, l.debit, l.credit,
           sum(l.debit - l.credit) over (order by l.happened_at, l.kind rows unbounded preceding)
      from lines l
     order by l.happened_at, l.kind;
end;
$$;

-- Everyone who owes money. days_owed counts from the oldest credit sale that
-- is still unpaid (payments clear the oldest sales first).
create function public.debtors()
returns table (
  id               uuid,
  name             text,
  phone            text,
  type             text,
  balance          numeric,
  credit_limit     numeric,
  oldest_unpaid_at timestamptz,
  days_owed        integer,
  last_payment_at  timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not public.is_owner() then
    raise exception 'Only the owner can view money owed' using errcode = '42501';
  end if;

  return query
    with credit_sales as (
      select s.customer_id, s.created_at, s.credit_amount,
             sum(s.credit_amount) over (partition by s.customer_id
                                        order by s.created_at desc, s.id desc) as newer_total
        from public.sales s
       where s.credit_amount > 0 and s.status = 'completed' and s.customer_id is not null
    )
    select c.id, c.name, c.phone, c.type, c.balance, c.credit_limit,
           ou.oldest,
           (public.accra_today() - (ou.oldest at time zone 'Africa/Accra')::date)::integer,
           (select max(cp.created_at) from public.credit_payments cp
             where cp.customer_id = c.id and cp.status = 'completed')
      from public.customers c
      left join lateral (
        select min(cs.created_at) as oldest
          from credit_sales cs
         where cs.customer_id = c.id and cs.newer_total - cs.credit_amount < c.balance
      ) ou on true
     where c.balance > 0
     order by ou.oldest nulls last, c.balance desc;
end;
$$;

revoke all on function public.record_credit_payment(uuid, numeric, text, text, text) from public, anon;
revoke all on function public.customer_statement(uuid) from public, anon;
revoke all on function public.debtors() from public, anon;
grant execute on function public.record_credit_payment(uuid, numeric, text, text, text) to authenticated;
grant execute on function public.customer_statement(uuid) to authenticated;
grant execute on function public.debtors() to authenticated;
