-- =============================================================================
-- Phase 7 · Approvals, refunds, voids, stock adjustments
--   request_approval(type, payload)        staff: ask the owner
--   decide_approval(id, approve, reason)   owner: approve (and carry out) or reject
--   refund_sale(sale_id, reason)           owner: goods came back, stock returns
--   void_sale(sale_id, reason)             owner: sale was a mistake, undo it
--   adjust_stock(product, change, reason, note)  owner: damaged/expired/stolen/correction
-- A reversed sale keeps its rows; status becomes refunded/void and refund
-- movements put the stock back.
-- =============================================================================

alter table public.sales
  add column reversed_at     timestamptz,
  add column reversed_by     uuid references public.profiles (id),
  add column reverse_reason  text check (char_length(reverse_reason) <= 500),
  add column credit_reversed numeric(12,2) not null default 0 check (credit_reversed >= 0),
  add column money_returned  numeric(12,2) not null default 0 check (money_returned >= 0);

-- -----------------------------------------------------------------------------
-- Internal: undo a completed sale (refund or void).
-- Credit is taken off the customer's balance first; whatever the customer
-- already paid in cash/MoMo (or paid back since) must be returned to them.
-- -----------------------------------------------------------------------------
create function public.reverse_sale(p_sale_id uuid, p_status text, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale     public.sales;
  v_item     public.sale_items;
  v_balance  numeric(12,2);
  v_credit   numeric(12,2) := 0;
  v_returned numeric(12,2);
begin
  if p_status not in ('refunded', 'void') then
    raise exception 'Invalid status' using errcode = '22023';
  end if;
  if nullif(btrim(p_reason), '') is null then
    raise exception 'Give a reason' using errcode = '22023';
  end if;

  select * into v_sale from public.sales where id = p_sale_id for update;
  if not found then
    raise exception 'Sale not found' using errcode = 'P0002';
  end if;

  -- A held sale never touched stock: cancelling it just marks it void.
  if v_sale.status = 'held_for_approval' and p_status = 'void' then
    update public.sales
       set status = 'void', reversed_at = now(), reversed_by = auth.uid(), reverse_reason = btrim(p_reason)
     where id = p_sale_id;
    return jsonb_build_object('sale_id', p_sale_id, 'status', 'void', 'money_returned', 0, 'credit_reversed', 0);
  end if;

  if v_sale.status <> 'completed' then
    raise exception 'Only completed sales can be refunded or cancelled (this one is %)', v_sale.status
      using errcode = '22023';
  end if;

  for v_item in select * from public.sale_items where sale_id = p_sale_id order by created_at, id
  loop
    insert into public.stock_movements (product_id, change_units, reason, ref_table, ref_id, note)
    values (v_item.product_id, v_item.units, 'refund', 'sales', p_sale_id,
            case p_status when 'void' then 'Sale cancelled' else 'Refund' end || ' ' || v_sale.receipt_no);
  end loop;

  if v_sale.credit_amount > 0 then
    select balance into v_balance from public.customers where id = v_sale.customer_id for update;
    v_credit := least(v_sale.credit_amount, v_balance);
    update public.customers set balance = balance - v_credit where id = v_sale.customer_id;
  end if;
  v_returned := v_sale.total - v_credit;

  update public.sales
     set status          = p_status,
         reversed_at     = now(),
         reversed_by     = auth.uid(),
         reverse_reason  = btrim(p_reason),
         credit_reversed = v_credit,
         money_returned  = v_returned
   where id = p_sale_id;

  insert into public.audit_logs (action, entity, entity_id, details)
  values ('sale_' || p_status, 'sales', p_sale_id,
          jsonb_build_object('receipt_no', v_sale.receipt_no, 'total', v_sale.total, 'reason', btrim(p_reason),
                             'money_returned', v_returned, 'credit_reversed', v_credit,
                             'attendant_id', v_sale.attendant_id));

  return jsonb_build_object('sale_id', p_sale_id, 'status', p_status,
                            'money_returned', v_returned, 'credit_reversed', v_credit);
end;
$$;

create function public.refund_sale(p_sale_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_owner() then
    raise exception 'Only the owner can refund sales' using errcode = '42501';
  end if;
  return public.reverse_sale(p_sale_id, 'refunded', p_reason);
end;
$$;

create function public.void_sale(p_sale_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_owner() then
    raise exception 'Only the owner can cancel sales' using errcode = '42501';
  end if;
  return public.reverse_sale(p_sale_id, 'void', p_reason);
end;
$$;

-- Internal + owner: one stock adjustment through the ledger.
create function public.apply_stock_adjustment(p_product_id uuid, p_change integer, p_reason text, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_reason not in ('adjust_damaged', 'adjust_expired', 'adjust_stolen', 'count_correction') then
    raise exception 'Choose damaged, expired, stolen/missing or count correction' using errcode = '22023';
  end if;
  if p_change is null or p_change = 0 then
    raise exception 'Enter how many units' using errcode = '22023';
  end if;
  if nullif(btrim(p_note), '') is null then
    raise exception 'Add a note saying what happened' using errcode = '22023';
  end if;
  insert into public.stock_movements (product_id, change_units, reason, ref_table, note)
  values (p_product_id, p_change, p_reason, 'adjustments', btrim(p_note));

  insert into public.audit_logs (action, entity, entity_id, details)
  values ('stock_adjustment', 'products', p_product_id,
          jsonb_build_object('change_units', p_change, 'reason', p_reason, 'note', btrim(p_note)));
end;
$$;

create function public.adjust_stock(p_product_id uuid, p_change integer, p_reason text, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_owner() then
    raise exception 'Only the owner can adjust stock. Ask through a request.' using errcode = '42501';
  end if;
  perform public.apply_stock_adjustment(p_product_id, p_change, p_reason, p_note);
end;
$$;

-- -----------------------------------------------------------------------------
-- request_approval: what attendants can ask for.
--   refund / void_sale:  { sale_id, reason }           (their own completed sale)
--   stock_adjustment:    { product_id, units, adjust_reason, reason }
--                        units > 0 are removed from stock
--   price_change:        { product_id, pack_id?, retail_price, wholesale_price, reason }
-- -----------------------------------------------------------------------------
create function public.request_approval(p_type text, p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me      uuid := auth.uid();
  v_reason  text := nullif(btrim(p_payload ->> 'reason'), '');
  v_sale    public.sales;
  v_product public.products;
  v_extra   jsonb := '{}'::jsonb;
  v_id      uuid;
begin
  if not public.is_staff() then
    raise exception 'Only approved staff can make requests' using errcode = '42501';
  end if;
  if v_reason is null then
    raise exception 'Give a reason for the owner' using errcode = '22023';
  end if;

  if p_type in ('refund', 'void_sale') then
    select * into v_sale from public.sales where id = nullif(p_payload ->> 'sale_id', '')::uuid;
    if not found or (v_sale.attendant_id <> v_me and not public.is_owner()) then
      raise exception 'Sale not found' using errcode = '22023';
    end if;
    if v_sale.status <> 'completed' then
      raise exception 'This sale is %, so it can''t be changed', replace(v_sale.status, '_', ' ') using errcode = '22023';
    end if;
    if exists (select 1 from public.approval_requests
                where status = 'pending' and type in ('refund', 'void_sale')
                  and payload ->> 'sale_id' = v_sale.id::text) then
      raise exception 'There is already a request waiting for this sale' using errcode = '22023';
    end if;
    v_extra := jsonb_build_object('sale_id', v_sale.id, 'receipt_no', v_sale.receipt_no, 'total', v_sale.total);

  elsif p_type = 'stock_adjustment' then
    select * into v_product from public.products where id = nullif(p_payload ->> 'product_id', '')::uuid;
    if not found then
      raise exception 'Product not found' using errcode = '22023';
    end if;
    if coalesce(nullif(p_payload ->> 'units', '')::integer, 0) <= 0 then
      raise exception 'Enter how many units' using errcode = '22023';
    end if;
    if coalesce(p_payload ->> 'adjust_reason', '') not in ('adjust_damaged', 'adjust_expired', 'adjust_stolen') then
      raise exception 'Choose damaged, expired or missing' using errcode = '22023';
    end if;
    v_extra := jsonb_build_object('product_id', v_product.id, 'product_name', v_product.name,
                                  'units', (p_payload ->> 'units')::integer,
                                  'adjust_reason', p_payload ->> 'adjust_reason',
                                  'base_unit', v_product.base_unit_name);

  elsif p_type = 'price_change' then
    select * into v_product from public.products where id = nullif(p_payload ->> 'product_id', '')::uuid;
    if not found then
      raise exception 'Product not found' using errcode = '22023';
    end if;
    if nullif(p_payload ->> 'pack_id', '') is not null
       and not exists (select 1 from public.product_packs
                        where id = (p_payload ->> 'pack_id')::uuid and product_id = v_product.id) then
      raise exception 'Pack not found' using errcode = '22023';
    end if;
    if coalesce(nullif(p_payload ->> 'retail_price', '')::numeric, 0) <= 0
       or coalesce(nullif(p_payload ->> 'wholesale_price', '')::numeric, 0) <= 0 then
      raise exception 'Enter the new prices' using errcode = '22023';
    end if;
    v_extra := jsonb_build_object('product_id', v_product.id, 'product_name', v_product.name,
                                  'pack_id', nullif(p_payload ->> 'pack_id', ''),
                                  'retail_price', round((p_payload ->> 'retail_price')::numeric, 2),
                                  'wholesale_price', round((p_payload ->> 'wholesale_price')::numeric, 2));
  else
    raise exception 'This kind of request is not allowed here' using errcode = '22023';
  end if;

  insert into public.approval_requests (type, requested_by, payload)
  values (p_type, v_me, v_extra || jsonb_build_object('reason', v_reason))
  returning id into v_id;
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- decide_approval: the owner says yes (and it is carried out) or no.
-- -----------------------------------------------------------------------------
create function public.decide_approval(p_request_id uuid, p_approve boolean, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_req    public.approval_requests;
  v_sale   public.sales;
  v_result jsonb := '{}'::jsonb;
  v_note   text := nullif(btrim(p_reason), '');
begin
  if not public.is_owner() then
    raise exception 'Only the owner can decide requests' using errcode = '42501';
  end if;
  select * into v_req from public.approval_requests where id = p_request_id for update;
  if not found then
    raise exception 'Request not found' using errcode = 'P0002';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'This request was already %', v_req.status using errcode = '22023';
  end if;

  if v_req.type in ('discount', 'credit_over_limit') then
    select * into v_sale from public.sales where id = (v_req.payload ->> 'sale_id')::uuid for update;
    if p_approve then
      if v_sale.status <> 'held_for_approval' then
        raise exception 'This sale is no longer waiting' using errcode = '22023';
      end if;
      update public.sales set status = 'completed' where id = v_sale.id;
      perform public.apply_sale_effects(v_sale.id);  -- fails cleanly if stock has run out
    else
      perform public.reverse_sale(v_sale.id, 'void', coalesce(v_note, 'Rejected by owner'));
    end if;

  elsif v_req.type in ('refund', 'void_sale') and p_approve then
    v_result := public.reverse_sale((v_req.payload ->> 'sale_id')::uuid,
                                    case v_req.type when 'refund' then 'refunded' else 'void' end,
                                    coalesce(v_req.payload ->> 'reason', '') ||
                                      coalesce(' (owner: ' || v_note || ')', ''));

  elsif v_req.type = 'stock_adjustment' and p_approve then
    perform public.apply_stock_adjustment(
      (v_req.payload ->> 'product_id')::uuid,
      -((v_req.payload ->> 'units')::integer),
      v_req.payload ->> 'adjust_reason',
      v_req.payload ->> 'reason');

  elsif v_req.type = 'price_change' and p_approve then
    if nullif(v_req.payload ->> 'pack_id', '') is not null then
      update public.product_packs
         set retail_price = (v_req.payload ->> 'retail_price')::numeric,
             wholesale_price = (v_req.payload ->> 'wholesale_price')::numeric
       where id = (v_req.payload ->> 'pack_id')::uuid;
    else
      update public.products
         set retail_price = (v_req.payload ->> 'retail_price')::numeric,
             wholesale_price = (v_req.payload ->> 'wholesale_price')::numeric
       where id = (v_req.payload ->> 'product_id')::uuid;
    end if;
  end if;

  update public.approval_requests
     set status = case when p_approve then 'approved' else 'rejected' end,
         decided_by = auth.uid(),
         decided_at = now(),
         reason = v_note
   where id = p_request_id;

  insert into public.audit_logs (action, entity, entity_id, details)
  values (case when p_approve then 'approval_approved' else 'approval_rejected' end,
          'approval_requests', p_request_id,
          jsonb_build_object('type', v_req.type, 'payload', v_req.payload, 'reason', v_note,
                             'requested_by', v_req.requested_by));

  return v_result || jsonb_build_object('status', case when p_approve then 'approved' else 'rejected' end);
end;
$$;

-- Statement now also shows credit taken off by refunds/cancellations.
create or replace function public.customer_statement(p_customer_id uuid)
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
         and not (s.status = 'void' and s.credit_reversed = 0 and s.reversed_at is not null
                  and not exists (select 1 from public.stock_movements m
                                   where m.ref_id = s.id and m.reason = 'sale'))
      union all
      select s.reversed_at, 'reversal', s.receipt_no,
             case s.status when 'refunded' then 'Refund' else 'Sale cancelled' end,
             0, s.credit_reversed
        from public.sales s
       where s.customer_id = p_customer_id and s.credit_reversed > 0
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

revoke all on function public.reverse_sale(uuid, text, text) from public, anon, authenticated;
revoke all on function public.apply_stock_adjustment(uuid, integer, text, text) from public, anon, authenticated;
revoke all on function public.refund_sale(uuid, text) from public, anon;
revoke all on function public.void_sale(uuid, text) from public, anon;
revoke all on function public.adjust_stock(uuid, integer, text, text) from public, anon;
revoke all on function public.request_approval(text, jsonb) from public, anon;
revoke all on function public.decide_approval(uuid, boolean, text) from public, anon;
grant execute on function public.refund_sale(uuid, text) to authenticated;
grant execute on function public.void_sale(uuid, text) to authenticated;
grant execute on function public.adjust_stock(uuid, integer, text, text) to authenticated;
grant execute on function public.request_approval(text, jsonb) to authenticated;
grant execute on function public.decide_approval(uuid, boolean, text) to authenticated;
