-- =============================================================================
-- Phase 4 · Selling
--   complete_sale(...)       staff: price, check and save a sale in one transaction
--   sale_receipt(sale_id)    owner or the sale's attendant: receipt details
--   apply_sale_effects(id)   internal: stock out, cost snapshot, customer balance
--
-- Prices ALWAYS come from the database. The client sends only product/pack ids,
-- quantities, price mode, payment amounts and (owner) discount.
-- =============================================================================

-- Same sale sent twice (double tap, weak internet) is saved only once.
alter table public.sales add column client_ref uuid unique;
-- Attendant's reason when a sale needs approval, or any note on the sale.
alter table public.sales add column note text check (char_length(note) <= 500);

-- -----------------------------------------------------------------------------
-- Internal: everything that happens when a sale becomes "completed".
-- Not callable through the API.
-- -----------------------------------------------------------------------------
create function public.apply_sale_effects(p_sale_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale public.sales;
  v_item public.sale_items;
  v_cost numeric(12,4);
begin
  select * into v_sale from public.sales where id = p_sale_id for update;

  for v_item in
    select * from public.sale_items where sale_id = p_sale_id order by created_at, id
  loop
    select c.cost_per_unit into v_cost from public.product_costs c where c.product_id = v_item.product_id;
    v_cost := coalesce(v_cost, 0);

    -- The stock trigger locks the product and rejects negative stock.
    insert into public.stock_movements (product_id, change_units, reason, ref_table, ref_id, unit_cost, user_id)
    values (v_item.product_id, -v_item.units, 'sale', 'sales', p_sale_id, v_cost, v_sale.attendant_id);

    insert into public.sale_item_costs (sale_item_id, sale_id, product_id, unit_cost, cost_total)
    values (v_item.id, p_sale_id, v_item.product_id, v_cost, round(v_cost * v_item.units, 2));
  end loop;

  if v_sale.credit_amount > 0 then
    update public.customers set balance = balance + v_sale.credit_amount where id = v_sale.customer_id;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Receipt for one sale (owner, or the attendant who made it).
-- -----------------------------------------------------------------------------
create function public.sale_receipt(p_sale_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_sale   public.sales;
  v_result jsonb;
begin
  select * into v_sale from public.sales where id = p_sale_id;
  if not found then
    raise exception 'Sale not found' using errcode = 'P0002';
  end if;
  if not (public.is_owner() or (public.is_staff() and v_sale.attendant_id = auth.uid())) then
    raise exception 'You can only see your own sales' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'sale_id',             v_sale.id,
    'receipt_no',          v_sale.receipt_no,
    'created_at',          v_sale.created_at,
    'status',              v_sale.status,
    'price_mode',          v_sale.price_mode,
    'subtotal',            v_sale.subtotal,
    'discount',            v_sale.discount,
    'total',               v_sale.total,
    'paid_cash',           v_sale.paid_cash,
    'paid_momo',           v_sale.paid_momo,
    'momo_txn_id',         v_sale.momo_txn_id,
    'credit_amount',       v_sale.credit_amount,
    'change_given',        v_sale.change_given,
    'note',                v_sale.note,
    'approval_request_id', v_sale.approval_request_id,
    'attendant_name',      (select full_name from public.profiles where id = v_sale.attendant_id),
    'customer', (
      select jsonb_build_object('id', c.id, 'name', c.name, 'phone', c.phone, 'balance', c.balance)
        from public.customers c where c.id = v_sale.customer_id),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'product_id', si.product_id,
               'name',       p.name,
               'pack_name',  pp.name,
               'unit_name',  coalesce(pp.name, p.base_unit_name),
               'qty',        si.qty,
               'units',      si.units,
               'unit_price', si.unit_price,
               'line_total', si.line_total) order by si.created_at, si.id)
        from public.sale_items si
        join public.products p on p.id = si.product_id
        left join public.product_packs pp on pp.id = si.pack_id
       where si.sale_id = v_sale.id), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

-- -----------------------------------------------------------------------------
-- complete_sale
--   p_items:    [{ product_id, pack_id?, qty }]   (any price sent is ignored)
--   p_payment:  { cash, momo, momo_txn_id, credit }  cash = money handed over
--   p_discount: GH₵ off the total. Attendant discounts need owner approval.
--   p_note:     reason for the owner when approval is needed
-- Credit beyond the customer's limit (attendant) or any attendant discount puts
-- the sale "on hold": nothing leaves stock until the owner approves.
-- -----------------------------------------------------------------------------
create function public.complete_sale(
  p_items      jsonb,
  p_price_mode text,
  p_customer_id uuid default null,
  p_payment    jsonb default '{}'::jsonb,
  p_discount   numeric default 0,
  p_client_ref uuid default null,
  p_note       text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me          uuid := auth.uid();
  v_is_owner    boolean := public.is_owner();
  v_existing    public.sales;
  v_item        jsonb;
  v_product     public.products;
  v_pack        public.product_packs;
  v_qty         integer;
  v_units       integer;
  v_price       numeric(12,2);
  v_lines       jsonb := '[]'::jsonb;
  v_subtotal    numeric(12,2) := 0;
  v_discount    numeric(12,2) := round(coalesce(p_discount, 0), 2);
  v_total       numeric(12,2);
  v_cash        numeric(12,2) := round(coalesce(nullif(p_payment ->> 'cash', '')::numeric, 0), 2);
  v_momo        numeric(12,2) := round(coalesce(nullif(p_payment ->> 'momo', '')::numeric, 0), 2);
  v_credit      numeric(12,2) := round(coalesce(nullif(p_payment ->> 'credit', '')::numeric, 0), 2);
  v_txn         text := nullif(btrim(p_payment ->> 'momo_txn_id'), '');
  v_note        text := nullif(btrim(p_note), '');
  v_cash_needed numeric(12,2);
  v_customer    public.customers;
  v_needs       text[] := '{}';
  v_short       record;
  v_request_id  uuid;
  v_sale_id     uuid;
begin
  if not public.is_staff() then
    raise exception 'Only approved staff can sell' using errcode = '42501';
  end if;
  if p_price_mode is null or p_price_mode not in ('retail', 'wholesale') then
    raise exception 'Choose Retail or Wholesale' using errcode = '22023';
  end if;

  -- Same sale sent again: return the first one instead of selling twice.
  if p_client_ref is not null then
    select * into v_existing from public.sales where client_ref = p_client_ref;
    if found then
      if v_existing.attendant_id <> v_me then
        raise exception 'This sale reference belongs to someone else' using errcode = '42501';
      end if;
      return public.sale_receipt(v_existing.id);
    end if;
  end if;

  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'The sale has no items' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) > 200 then
    raise exception 'Too many lines in one sale' using errcode = '22023';
  end if;

  -- 1. Price every line from the database.
  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_qty := nullif(v_item ->> 'qty', '')::integer;
    if v_qty is null or v_qty <= 0 then
      raise exception 'Quantity must be at least 1' using errcode = '22023';
    end if;
    if v_qty > 100000 then
      raise exception 'Quantity is too large' using errcode = '22023';
    end if;

    select * into v_product from public.products where id = nullif(v_item ->> 'product_id', '')::uuid;
    if not found or not v_product.is_active then
      raise exception 'A product in this sale is no longer for sale' using errcode = '22023';
    end if;

    if nullif(v_item ->> 'pack_id', '') is not null then
      select * into v_pack from public.product_packs
       where id = (v_item ->> 'pack_id')::uuid and product_id = v_product.id;
      if not found or not v_pack.is_active then
        raise exception '% pack is no longer for sale', v_product.name using errcode = '22023';
      end if;
      v_units := v_qty * v_pack.units_per_pack;
      v_price := case when p_price_mode = 'wholesale' and v_qty >= v_pack.min_wholesale_qty
                      then v_pack.wholesale_price else v_pack.retail_price end;
    else
      v_pack := null;
      v_units := v_qty;
      v_price := case when p_price_mode = 'wholesale' and v_qty >= v_product.min_wholesale_qty
                      then v_product.wholesale_price else v_product.retail_price end;
    end if;

    v_subtotal := v_subtotal + v_qty * v_price;
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'product_id', v_product.id, 'pack_id', v_pack.id, 'qty', v_qty,
      'units', v_units, 'unit_price', v_price, 'line_total', v_qty * v_price));
  end loop;

  -- 2. Check there is enough stock for every product (all lines together).
  for v_short in
    select p.name, p.stock_units, sum((l ->> 'units')::integer) as needed
      from jsonb_array_elements(v_lines) l
      join public.products p on p.id = (l ->> 'product_id')::uuid
     group by p.id, p.name, p.stock_units
    having sum((l ->> 'units')::integer) > p.stock_units
  loop
    raise exception 'Not enough stock for %: % in stock, % needed', v_short.name, v_short.stock_units, v_short.needed
      using errcode = '23514';
  end loop;

  -- 3. Totals and payment.
  if v_discount < 0 or v_discount > v_subtotal then
    raise exception 'Discount must be between 0 and the sale total' using errcode = '22023';
  end if;
  v_total := v_subtotal - v_discount;

  if v_cash < 0 or v_momo < 0 or v_credit < 0 then
    raise exception 'Payment amounts cannot be negative' using errcode = '22023';
  end if;
  v_cash_needed := v_total - v_momo - v_credit;
  if v_cash_needed < 0 then
    raise exception 'MoMo and credit add up to more than the total' using errcode = '22023';
  end if;
  if v_cash < v_cash_needed then
    raise exception 'Not enough cash: GH₵ % more needed', to_char(v_cash_needed - v_cash, 'FM999999990.00')
      using errcode = '22023';
  end if;
  if v_momo > 0 and v_txn is null then
    raise exception 'Enter the MoMo transaction ID' using errcode = '22023';
  end if;

  -- 4. Customer and credit.
  if p_customer_id is not null then
    select * into v_customer from public.customers where id = p_customer_id for update;
    if not found or not v_customer.is_active then
      raise exception 'Customer not found' using errcode = '22023';
    end if;
  end if;
  if v_credit > 0 and p_customer_id is null then
    raise exception 'Choose a customer to give credit' using errcode = '22023';
  end if;

  -- 5. Does the owner need to approve this?
  if v_discount > 0 and not v_is_owner then
    v_needs := array_append(v_needs, 'discount');
  end if;
  if v_credit > 0 and not v_is_owner and v_customer.balance + v_credit > v_customer.credit_limit then
    v_needs := array_append(v_needs, 'credit_over_limit');
  end if;

  if cardinality(v_needs) > 0 then
    if v_note is null then
      raise exception 'Give a reason for the owner' using errcode = '22023';
    end if;
    insert into public.approval_requests (type, requested_by, payload)
    values (v_needs[1], v_me, jsonb_build_object(
      'reasons',       to_jsonb(v_needs),
      'reason',        v_note,
      'total',         v_total,
      'subtotal',      v_subtotal,
      'discount',      v_discount,
      'credit',        v_credit,
      'customer_id',   v_customer.id,
      'customer_name', v_customer.name,
      'balance',       v_customer.balance,
      'credit_limit',  v_customer.credit_limit))
    returning id into v_request_id;
  end if;

  -- 6. Save the sale and its lines.
  insert into public.sales (
    attendant_id, customer_id, price_mode, subtotal, discount, total,
    paid_cash, paid_momo, momo_txn_id, credit_amount, change_given,
    status, approval_request_id, client_ref, note)
  values (
    v_me, p_customer_id, p_price_mode, v_subtotal, v_discount, v_total,
    v_cash, v_momo, v_txn, v_credit, v_cash - v_cash_needed,
    case when v_request_id is null then 'completed' else 'held_for_approval' end,
    v_request_id, p_client_ref, v_note)
  returning id into v_sale_id;

  insert into public.sale_items (sale_id, product_id, pack_id, qty, units, unit_price, line_total)
  select v_sale_id, (l ->> 'product_id')::uuid, nullif(l ->> 'pack_id', '')::uuid,
         (l ->> 'qty')::integer, (l ->> 'units')::integer,
         (l ->> 'unit_price')::numeric, (l ->> 'line_total')::numeric
    from jsonb_array_elements(v_lines) with ordinality as t(l, n)
   order by n;

  if v_request_id is null then
    perform public.apply_sale_effects(v_sale_id);
  else
    update public.approval_requests
       set payload = payload || jsonb_build_object('sale_id', v_sale_id)
     where id = v_request_id;
  end if;

  -- 7. Audit the sensitive parts.
  if v_discount > 0 or v_request_id is not null
     or (v_credit > 0 and v_customer.balance + v_credit > v_customer.credit_limit) then
    insert into public.audit_logs (action, entity, entity_id, details)
    values (
      case when v_request_id is not null then 'sale_held' else 'sale_with_override' end,
      'sales', v_sale_id,
      jsonb_build_object('discount', v_discount, 'credit', v_credit, 'total', v_total,
                         'over_limit', v_credit > 0 and v_customer.balance + v_credit > v_customer.credit_limit,
                         'customer', v_customer.name, 'note', v_note));
  end if;

  return public.sale_receipt(v_sale_id);
end;
$$;

revoke all on function public.apply_sale_effects(uuid) from public, anon, authenticated;
revoke all on function public.sale_receipt(uuid) from public, anon;
revoke all on function public.complete_sale(jsonb, text, uuid, jsonb, numeric, uuid, text) from public, anon;
grant execute on function public.sale_receipt(uuid) to authenticated;
grant execute on function public.complete_sale(jsonb, text, uuid, jsonb, numeric, uuid, text) to authenticated;
