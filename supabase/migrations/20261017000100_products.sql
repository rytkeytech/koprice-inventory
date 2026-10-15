-- =============================================================================
-- Phase 3 · Products
--   save_product(p jsonb)        owner: create/update a product with its packs,
--                                cost and (new products only) opening stock
--   import_products(rows jsonb)  owner: bulk create/update from Excel,
--                                all-or-nothing
-- =============================================================================

-- p = {
--   id?, name, category_id?, brand?, base_unit_name?, barcode?,
--   retail_price, wholesale_price, min_wholesale_qty?, reorder_level?,
--   is_quick_sell?, photo_url?, is_active?,
--   cost_per_unit?,                         -- per BASE unit
--   opening_stock?,                         -- base units, new products only
--   opening_reason?,                        -- 'opening_stock' (default) | 'import'
--   packs?: [{ id?, name, units_per_pack, barcode?, retail_price,
--              wholesale_price, min_wholesale_qty?, is_quick_sell?, is_active? }]
-- }
create function public.save_product(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id      uuid := nullif(p ->> 'id', '')::uuid;
  v_is_new  boolean := nullif(p ->> 'id', '') is null;
  v_cost    numeric := nullif(p ->> 'cost_per_unit', '')::numeric;
  v_opening integer := coalesce(nullif(p ->> 'opening_stock', '')::integer, 0);
  v_reason  text := coalesce(nullif(p ->> 'opening_reason', ''), 'opening_stock');
  v_pack    jsonb;
  v_pack_id uuid;
begin
  if not public.is_owner() then
    raise exception 'Only the owner can save products' using errcode = '42501';
  end if;

  if v_reason not in ('opening_stock', 'import') then
    raise exception 'Invalid opening stock reason' using errcode = '22023';
  end if;

  if v_opening < 0 then
    raise exception 'Opening stock cannot be negative' using errcode = '22023';
  end if;

  if v_is_new then
    insert into public.products (
      name, category_id, brand, base_unit_name, barcode, retail_price, wholesale_price,
      min_wholesale_qty, reorder_level, is_quick_sell, photo_url, is_active)
    values (
      btrim(p ->> 'name'),
      nullif(p ->> 'category_id', '')::uuid,
      nullif(btrim(p ->> 'brand'), ''),
      coalesce(nullif(btrim(p ->> 'base_unit_name'), ''), 'piece'),
      nullif(btrim(p ->> 'barcode'), ''),
      (p ->> 'retail_price')::numeric,
      (p ->> 'wholesale_price')::numeric,
      coalesce(nullif(p ->> 'min_wholesale_qty', '')::integer, 1),
      coalesce(nullif(p ->> 'reorder_level', '')::integer, 0),
      coalesce((p ->> 'is_quick_sell')::boolean, false),
      nullif(p ->> 'photo_url', ''),
      coalesce((p ->> 'is_active')::boolean, true))
    returning id into v_id;
  else
    update public.products
       set name              = btrim(p ->> 'name'),
           category_id       = nullif(p ->> 'category_id', '')::uuid,
           brand             = nullif(btrim(p ->> 'brand'), ''),
           base_unit_name    = coalesce(nullif(btrim(p ->> 'base_unit_name'), ''), 'piece'),
           barcode           = nullif(btrim(p ->> 'barcode'), ''),
           retail_price      = (p ->> 'retail_price')::numeric,
           wholesale_price   = (p ->> 'wholesale_price')::numeric,
           min_wholesale_qty = coalesce(nullif(p ->> 'min_wholesale_qty', '')::integer, 1),
           reorder_level     = coalesce(nullif(p ->> 'reorder_level', '')::integer, 0),
           is_quick_sell     = coalesce((p ->> 'is_quick_sell')::boolean, false),
           photo_url         = nullif(p ->> 'photo_url', ''),
           is_active         = coalesce((p ->> 'is_active')::boolean, true)
     where id = v_id;
    if not found then
      raise exception 'Product not found' using errcode = 'P0002';
    end if;
  end if;

  if v_cost is not null then
    insert into public.product_costs (product_id, cost_per_unit)
    values (v_id, v_cost)
    on conflict (product_id) do update
      set cost_per_unit = excluded.cost_per_unit
      where public.product_costs.cost_per_unit is distinct from excluded.cost_per_unit;
  end if;

  for v_pack in select value from jsonb_array_elements(coalesce(p -> 'packs', '[]'::jsonb))
  loop
    v_pack_id := nullif(v_pack ->> 'id', '')::uuid;
    if v_pack_id is null then
      insert into public.product_packs (
        product_id, name, units_per_pack, barcode, retail_price, wholesale_price,
        min_wholesale_qty, is_quick_sell, is_active)
      values (
        v_id,
        btrim(v_pack ->> 'name'),
        (v_pack ->> 'units_per_pack')::integer,
        nullif(btrim(v_pack ->> 'barcode'), ''),
        (v_pack ->> 'retail_price')::numeric,
        (v_pack ->> 'wholesale_price')::numeric,
        coalesce(nullif(v_pack ->> 'min_wholesale_qty', '')::integer, 1),
        coalesce((v_pack ->> 'is_quick_sell')::boolean, false),
        coalesce((v_pack ->> 'is_active')::boolean, true));
    else
      update public.product_packs
         set name              = btrim(v_pack ->> 'name'),
             units_per_pack    = (v_pack ->> 'units_per_pack')::integer,
             barcode           = nullif(btrim(v_pack ->> 'barcode'), ''),
             retail_price      = (v_pack ->> 'retail_price')::numeric,
             wholesale_price   = (v_pack ->> 'wholesale_price')::numeric,
             min_wholesale_qty = coalesce(nullif(v_pack ->> 'min_wholesale_qty', '')::integer, 1),
             is_quick_sell     = coalesce((v_pack ->> 'is_quick_sell')::boolean, false),
             is_active         = coalesce((v_pack ->> 'is_active')::boolean, true)
       where id = v_pack_id and product_id = v_id;
      if not found then
        raise exception 'Pack not found for this product' using errcode = 'P0002';
      end if;
    end if;
  end loop;

  -- Stock for a new product enters through the ledger, never directly.
  if v_is_new and v_opening > 0 then
    insert into public.stock_movements (product_id, change_units, reason, note)
    values (v_id, v_opening, v_reason,
            case v_reason when 'import' then 'Opening stock (Excel import)' else 'Opening stock' end);
  end if;

  return v_id;
end;
$$;

-- rows = [{ row_number, name, category, brand?, base_unit?, barcode?,
--           cost_per_unit?, retail_price, wholesale_price, min_wholesale_qty?,
--           opening_stock_units?, reorder_level?, quick_sell?,
--           packs?: [{ name, units_per_pack, barcode?, retail_price,
--                      wholesale_price, min_wholesale_qty? }] }]
-- Existing products are matched by barcode, then by name. Their stock is NOT
-- changed by an import (use a stock count for that); they are listed in
-- stock_not_changed. Any bad row stops the whole import.
create function public.import_products(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row         jsonb;
  v_row_no      integer;
  v_category_id uuid;
  v_existing    public.products;
  v_pack        jsonb;
  v_packs       jsonb;
  v_pack_id     uuid;
  v_opening     integer;
  v_created     integer := 0;
  v_updated     integer := 0;
  v_skipped     jsonb := '[]'::jsonb;
begin
  if not public.is_owner() then
    raise exception 'Only the owner can import products' using errcode = '42501';
  end if;

  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'The file has no product rows' using errcode = '22023';
  end if;

  for v_row, v_row_no in
    select value, coalesce(nullif(value ->> 'row_number', '')::integer, (ordinality + 1)::integer)
      from jsonb_array_elements(p_rows) with ordinality
  loop
    begin
      v_category_id := null;
      if nullif(btrim(v_row ->> 'category'), '') is not null then
        select c.id into v_category_id
          from public.categories c
         where lower(c.name) = lower(btrim(v_row ->> 'category'));
        if not found then
          raise exception 'unknown category "%"', btrim(v_row ->> 'category');
        end if;
      end if;

      v_existing := null;
      if nullif(btrim(v_row ->> 'barcode'), '') is not null then
        select * into v_existing from public.products
         where barcode = btrim(v_row ->> 'barcode');
      end if;
      if v_existing.id is null then
        select * into v_existing from public.products
         where lower(name) = lower(btrim(v_row ->> 'name'))
         order by created_at
         limit 1;
      end if;

      -- Match packs by name so re-importing updates instead of duplicating.
      v_packs := '[]'::jsonb;
      for v_pack in select value from jsonb_array_elements(coalesce(v_row -> 'packs', '[]'::jsonb))
      loop
        v_pack_id := null;
        if v_existing.id is not null then
          select pp.id into v_pack_id from public.product_packs pp
           where pp.product_id = v_existing.id and lower(pp.name) = lower(btrim(v_pack ->> 'name'));
        end if;
        v_packs := v_packs || jsonb_build_array(v_pack || jsonb_build_object('id', v_pack_id));
      end loop;

      v_opening := coalesce(nullif(v_row ->> 'opening_stock_units', '')::integer, 0);

      perform public.save_product(jsonb_build_object(
        'id',                v_existing.id,
        'name',              v_row ->> 'name',
        'category_id',       v_category_id,
        'brand',             v_row ->> 'brand',
        'base_unit_name',    v_row ->> 'base_unit',
        'barcode',           v_row ->> 'barcode',
        'retail_price',      v_row ->> 'retail_price',
        'wholesale_price',   v_row ->> 'wholesale_price',
        'min_wholesale_qty', v_row ->> 'min_wholesale_qty',
        'reorder_level',     coalesce(v_row ->> 'reorder_level', v_existing.reorder_level::text),
        'is_quick_sell',     coalesce((v_row ->> 'quick_sell')::boolean, v_existing.is_quick_sell, false),
        'photo_url',         v_existing.photo_url,
        'is_active',         true,
        'cost_per_unit',     v_row ->> 'cost_per_unit',
        'opening_stock',     case when v_existing.id is null then v_opening else 0 end,
        'opening_reason',    'import',
        'packs',             v_packs));

      if v_existing.id is null then
        v_created := v_created + 1;
      else
        v_updated := v_updated + 1;
        if v_opening > 0 and v_opening <> v_existing.stock_units then
          v_skipped := v_skipped || to_jsonb(v_existing.name);
        end if;
      end if;
    exception when others then
      raise exception 'Row %: %', v_row_no, sqlerrm using errcode = sqlstate;
    end;
  end loop;

  insert into public.audit_logs (action, entity, details)
  values ('import', 'products',
          jsonb_build_object('created', v_created, 'updated', v_updated, 'rows', jsonb_array_length(p_rows)));

  return jsonb_build_object('created', v_created, 'updated', v_updated, 'stock_not_changed', v_skipped);
end;
$$;

revoke all on function public.save_product(jsonb) from public, anon;
revoke all on function public.import_products(jsonb) from public, anon;
grant execute on function public.save_product(jsonb) to authenticated;
grant execute on function public.import_products(jsonb) to authenticated;
