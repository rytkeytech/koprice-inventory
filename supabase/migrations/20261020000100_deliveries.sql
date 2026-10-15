-- =============================================================================
-- Phase 6 · Receive goods
--   record_delivery(...)   staff: stock goes up now; delivery waits for owner
--                          check (owner's own deliveries can be confirmed at once)
--   confirm_delivery(...)  owner: set costs, mark confirmed or queried
--   delivery_details(id)   owner or receiver: delivery with items (+ costs for owner)
-- Costs are per BASE unit. The owner may type cost per pack; the app converts.
-- =============================================================================

alter table public.deliveries add column client_ref uuid unique;

-- Internal: save one item's cost and make it the product's current cost.
create function public.set_delivery_item_cost(p_item_id uuid, p_cost_per_unit numeric)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.delivery_items;
begin
  if p_cost_per_unit is null then
    return;
  end if;
  if p_cost_per_unit < 0 then
    raise exception 'Cost cannot be negative' using errcode = '22023';
  end if;
  select * into v_item from public.delivery_items where id = p_item_id;

  insert into public.delivery_item_costs (delivery_item_id, delivery_id, unit_cost)
  values (v_item.id, v_item.delivery_id, round(p_cost_per_unit, 4))
  on conflict (delivery_item_id) do update set unit_cost = excluded.unit_cost, set_by = auth.uid();

  insert into public.product_costs (product_id, cost_per_unit)
  values (v_item.product_id, round(p_cost_per_unit, 4))
  on conflict (product_id) do update
    set cost_per_unit = excluded.cost_per_unit
    where public.product_costs.cost_per_unit is distinct from excluded.cost_per_unit;
end;
$$;

-- p_items = [{ product_id, pack_id?, qty, cost_per_unit? }]  (cost: owner only)
create function public.record_delivery(
  p_supplier_id uuid,
  p_items       jsonb,
  p_photo_path  text default null,
  p_note        text default null,
  p_client_ref  uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me          uuid := auth.uid();
  v_is_owner    boolean := public.is_owner();
  v_existing    public.deliveries;
  v_item        jsonb;
  v_product     public.products;
  v_pack        public.product_packs;
  v_qty         integer;
  v_units       integer;
  v_delivery_id uuid;
  v_item_id     uuid;
  v_all_costed  boolean := true;
  v_status      text;
begin
  if not public.is_staff() then
    raise exception 'Only approved staff can receive goods' using errcode = '42501';
  end if;

  if p_client_ref is not null then
    select * into v_existing from public.deliveries where client_ref = p_client_ref;
    if found then
      return jsonb_build_object('delivery_id', v_existing.id, 'status', v_existing.status);
    end if;
  end if;

  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Add at least one item' using errcode = '22023';
  end if;
  if p_supplier_id is not null and not exists (select 1 from public.suppliers where id = p_supplier_id) then
    raise exception 'Supplier not found' using errcode = '22023';
  end if;
  -- Staff may only attach invoice photos from their own upload folder.
  if p_photo_path is not null and split_part(p_photo_path, '/', 1) <> v_me::text then
    raise exception 'Invalid invoice photo' using errcode = '22023';
  end if;

  insert into public.deliveries (supplier_id, received_by, invoice_photo_url, note, client_ref)
  values (p_supplier_id, v_me, nullif(p_photo_path, ''), nullif(btrim(p_note), ''), p_client_ref)
  returning id into v_delivery_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_qty := nullif(v_item ->> 'qty', '')::integer;
    if v_qty is null or v_qty <= 0 then
      raise exception 'Quantity must be at least 1' using errcode = '22023';
    end if;
    select * into v_product from public.products where id = nullif(v_item ->> 'product_id', '')::uuid;
    if not found then
      raise exception 'Product not found' using errcode = '22023';
    end if;
    if nullif(v_item ->> 'pack_id', '') is not null then
      select * into v_pack from public.product_packs where id = (v_item ->> 'pack_id')::uuid and product_id = v_product.id;
      if not found then
        raise exception 'Pack not found for %', v_product.name using errcode = '22023';
      end if;
      v_units := v_qty * v_pack.units_per_pack;
    else
      v_pack := null;
      v_units := v_qty;
    end if;

    insert into public.delivery_items (delivery_id, product_id, pack_id, qty, units)
    values (v_delivery_id, v_product.id, v_pack.id, v_qty, v_units)
    returning id into v_item_id;

    -- Only the owner can set costs. Set before the movement so its cost snapshot is right.
    if v_is_owner and nullif(v_item ->> 'cost_per_unit', '') is not null then
      perform public.set_delivery_item_cost(v_item_id, (v_item ->> 'cost_per_unit')::numeric);
    else
      v_all_costed := false;
    end if;

    insert into public.stock_movements (product_id, change_units, reason, ref_table, ref_id)
    values (v_product.id, v_units, 'delivery', 'deliveries', v_delivery_id);
  end loop;

  -- The owner's own delivery with every cost filled in needs no second check.
  v_status := case when v_is_owner and v_all_costed then 'confirmed' else 'pending_check' end;
  if v_status = 'confirmed' then
    update public.deliveries set status = 'confirmed', checked_by = v_me, checked_at = now() where id = v_delivery_id;
  end if;

  return jsonb_build_object('delivery_id', v_delivery_id, 'status', v_status);
end;
$$;

-- p_costs = [{ delivery_item_id, cost_per_unit }]   p_status = confirmed | queried
create function public.confirm_delivery(
  p_delivery_id uuid,
  p_costs       jsonb,
  p_status      text,
  p_note        text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_delivery public.deliveries;
  v_cost     jsonb;
begin
  if not public.is_owner() then
    raise exception 'Only the owner can check deliveries' using errcode = '42501';
  end if;
  if p_status is null or p_status not in ('confirmed', 'queried') then
    raise exception 'Choose confirm or query' using errcode = '22023';
  end if;

  select * into v_delivery from public.deliveries where id = p_delivery_id for update;
  if not found then
    raise exception 'Delivery not found' using errcode = 'P0002';
  end if;
  if v_delivery.status = 'confirmed' then
    raise exception 'This delivery is already confirmed' using errcode = '22023';
  end if;
  if p_status = 'queried' and nullif(btrim(p_note), '') is null then
    raise exception 'Say what is wrong with the delivery' using errcode = '22023';
  end if;

  for v_cost in select value from jsonb_array_elements(coalesce(p_costs, '[]'::jsonb))
  loop
    if not exists (select 1 from public.delivery_items
                    where id = (v_cost ->> 'delivery_item_id')::uuid and delivery_id = p_delivery_id) then
      raise exception 'Item does not belong to this delivery' using errcode = '22023';
    end if;
    perform public.set_delivery_item_cost((v_cost ->> 'delivery_item_id')::uuid,
                                          nullif(v_cost ->> 'cost_per_unit', '')::numeric);
  end loop;

  update public.deliveries
     set status     = p_status,
         checked_by = auth.uid(),
         checked_at = now(),
         note       = concat_ws(E'\n', note, case when nullif(btrim(p_note), '') is not null
                                               then 'Owner: ' || btrim(p_note) end)
   where id = p_delivery_id;

  insert into public.audit_logs (action, entity, entity_id, details)
  values ('delivery_' || p_status, 'deliveries', p_delivery_id,
          jsonb_build_object('note', p_note, 'costs', coalesce(p_costs, '[]'::jsonb)));
end;
$$;

create function public.delivery_details(p_delivery_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_delivery public.deliveries;
  v_is_owner boolean := public.is_owner();
begin
  select * into v_delivery from public.deliveries where id = p_delivery_id;
  if not found then
    raise exception 'Delivery not found' using errcode = 'P0002';
  end if;
  if not (v_is_owner or (public.is_staff() and v_delivery.received_by = auth.uid())) then
    raise exception 'You can only see your own deliveries' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'id',               v_delivery.id,
    'created_at',       v_delivery.created_at,
    'status',           v_delivery.status,
    'note',             v_delivery.note,
    'invoice_photo',    v_delivery.invoice_photo_url,
    'checked_at',       v_delivery.checked_at,
    'supplier',         (select s.name from public.suppliers s where s.id = v_delivery.supplier_id),
    'received_by_name', (select p.full_name from public.profiles p where p.id = v_delivery.received_by),
    'checked_by_name',  (select p.full_name from public.profiles p where p.id = v_delivery.checked_by),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id',            di.id,
               'product_id',    di.product_id,
               'name',          p.name,
               'base_unit',     p.base_unit_name,
               'pack_name',     pp.name,
               'units_per_pack', coalesce(pp.units_per_pack, 1),
               'qty',           di.qty,
               'units',         di.units,
               'cost_per_unit', case when v_is_owner then coalesce(dc.unit_cost, pc.cost_per_unit) end,
               'cost_is_set',   case when v_is_owner then dc.unit_cost is not null end)
             order by di.created_at, di.id)
        from public.delivery_items di
        join public.products p on p.id = di.product_id
        left join public.product_packs pp on pp.id = di.pack_id
        left join public.delivery_item_costs dc on dc.delivery_item_id = di.id
        left join public.product_costs pc on pc.product_id = di.product_id
       where di.delivery_id = v_delivery.id), '[]'::jsonb));
end;
$$;

revoke all on function public.set_delivery_item_cost(uuid, numeric) from public, anon, authenticated;
revoke all on function public.record_delivery(uuid, jsonb, text, text, uuid) from public, anon;
revoke all on function public.confirm_delivery(uuid, jsonb, text, text) from public, anon;
revoke all on function public.delivery_details(uuid) from public, anon;
grant execute on function public.record_delivery(uuid, jsonb, text, text, uuid) to authenticated;
grant execute on function public.confirm_delivery(uuid, jsonb, text, text) to authenticated;
grant execute on function public.delivery_details(uuid) to authenticated;
