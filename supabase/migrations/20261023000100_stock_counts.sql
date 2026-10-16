-- =============================================================================
-- Phase 9 · Stock counts and missing stock
--   start_stock_count(type, product_ids, note)  owner: spot (chosen) or full count
--   count_sheet(count_id)                       staff: what to count (no expected
--                                                figures for attendants: blind count)
--   submit_count_item(count_id, product, units) staff: record a counted quantity
--   complete_stock_count(count_id, apply)       owner: finish; optionally correct stock
--   missing_stock_report(from, to)              owner: missing value at COST
--
-- "Expected" is snapshotted when each item is counted, so sales made during a
-- long count don't show up as missing stock.
-- =============================================================================

create function public.start_stock_count(p_type text, p_product_ids uuid[] default null, p_note text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.is_owner() then
    raise exception 'Only the owner can start a stock count' using errcode = '42501';
  end if;
  if p_type is null or p_type not in ('spot', 'full') then
    raise exception 'Choose a spot count or a full count' using errcode = '22023';
  end if;
  if p_type = 'spot' and coalesce(cardinality(p_product_ids), 0) = 0 then
    raise exception 'Choose the products to count' using errcode = '22023';
  end if;

  insert into public.stock_counts (type, note) values (p_type, nullif(btrim(p_note), ''))
  returning id into v_id;

  insert into public.stock_count_items (count_id, product_id, expected_units, unit_cost)
  select v_id, p.id, p.stock_units, c.cost_per_unit
    from public.products p
    left join public.product_costs c on c.product_id = p.id
   where p.is_active
     and (p_type = 'full' or p.id = any (p_product_ids));

  if not exists (select 1 from public.stock_count_items where count_id = v_id) then
    raise exception 'No products to count' using errcode = '22023';
  end if;

  insert into public.audit_logs (action, entity, entity_id, details)
  values ('stock_count_started', 'stock_counts', v_id,
          jsonb_build_object('type', p_type, 'items', (select count(*) from public.stock_count_items where count_id = v_id)));
  return v_id;
end;
$$;

create function public.count_sheet(p_count_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_count    public.stock_counts;
  v_is_owner boolean := public.is_owner();
begin
  if not public.is_staff() then
    raise exception 'Only approved staff' using errcode = '42501';
  end if;
  select * into v_count from public.stock_counts where id = p_count_id;
  if not found or (v_count.status <> 'open' and not v_is_owner) then
    raise exception 'Stock count not found' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'id', v_count.id,
    'type', v_count.type,
    'status', v_count.status,
    'note', v_count.note,
    'created_at', v_count.created_at,
    'completed_at', v_count.completed_at,
    'corrections_applied', v_count.corrections_applied,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'product_id', p.id,
               'name', p.name,
               'base_unit', p.base_unit_name,
               'category_id', p.category_id,
               'packs', coalesce((select jsonb_agg(jsonb_build_object('name', pp.name, 'units_per_pack', pp.units_per_pack)
                                                   order by pp.units_per_pack desc)
                                    from public.product_packs pp
                                   where pp.product_id = p.id and pp.is_active), '[]'::jsonb),
               'counted_units', i.counted_units,
               'counted_at', i.counted_at,
               'counted_by', (select split_part(pr.full_name, ' ', 1) from public.profiles pr where pr.id = i.counted_by),
               -- Owner only: what the system expected, and the difference.
               'expected_units', case when v_is_owner then i.expected_units end,
               'difference_units', case when v_is_owner then i.difference_units end,
               'difference_cost', case when v_is_owner then i.difference_cost end,
               'unit_cost', case when v_is_owner then i.unit_cost end)
             order by p.name)
        from public.stock_count_items i
        join public.products p on p.id = i.product_id
       where i.count_id = v_count.id), '[]'::jsonb));
end;
$$;

create function public.submit_count_item(p_count_id uuid, p_product_id uuid, p_counted_units integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count public.stock_counts;
begin
  if not public.is_staff() then
    raise exception 'Only approved staff can count' using errcode = '42501';
  end if;
  if p_counted_units is null or p_counted_units < 0 then
    raise exception 'Enter how many you counted (0 or more)' using errcode = '22023';
  end if;
  select * into v_count from public.stock_counts where id = p_count_id;
  if not found or v_count.status <> 'open' then
    raise exception 'This stock count is closed' using errcode = '22023';
  end if;

  update public.stock_count_items i
     set counted_units  = p_counted_units,
         counted_by     = auth.uid(),
         counted_at     = now(),
         expected_units = p.stock_units,
         unit_cost      = (select c.cost_per_unit from public.product_costs c where c.product_id = p.id)
    from public.products p
   where i.count_id = p_count_id
     and i.product_id = p_product_id
     and p.id = i.product_id;
  if not found then
    raise exception 'This product is not part of the count' using errcode = '22023';
  end if;
end;
$$;

create function public.complete_stock_count(p_count_id uuid, p_apply boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count   public.stock_counts;
  v_item    public.stock_count_items;
  v_changes integer := 0;
begin
  if not public.is_owner() then
    raise exception 'Only the owner can finish a stock count' using errcode = '42501';
  end if;
  select * into v_count from public.stock_counts where id = p_count_id for update;
  if not found then
    raise exception 'Stock count not found' using errcode = 'P0002';
  end if;
  if v_count.status <> 'open' then
    raise exception 'This stock count is already finished' using errcode = '22023';
  end if;

  if p_apply then
    for v_item in
      select * from public.stock_count_items
       where count_id = p_count_id and counted_units is not null and difference_units <> 0
    loop
      perform public.apply_stock_adjustment(
        v_item.product_id, v_item.difference_units, 'count_correction',
        'Stock count ' || to_char(v_count.created_at at time zone 'Africa/Accra', 'DD Mon YYYY'));
      v_changes := v_changes + 1;
    end loop;
  end if;

  update public.stock_counts
     set status = 'completed', completed_at = now(), corrections_applied = coalesce(p_apply, false)
   where id = p_count_id;

  insert into public.audit_logs (action, entity, entity_id, details)
  values ('stock_count_completed', 'stock_counts', p_count_id,
          jsonb_build_object('applied', coalesce(p_apply, false), 'corrections', v_changes,
                             'missing_value', (select coalesce(sum(difference_cost), 0) from public.stock_count_items
                                                where count_id = p_count_id and difference_units < 0)));

  return jsonb_build_object('corrections', v_changes);
end;
$$;

-- Missing stock between two dates (Accra calendar days, inclusive).
create function public.missing_stock_report(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_from timestamptz := (p_from::timestamp at time zone 'Africa/Accra');
  v_to   timestamptz := ((p_to + 1)::timestamp at time zone 'Africa/Accra');
begin
  if not public.is_owner() then
    raise exception 'Only the owner can see this report' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'counts', (select count(*) from public.stock_counts
                where status = 'completed' and completed_at >= v_from and completed_at < v_to),
    'missing_value', (select coalesce(-sum(i.difference_cost), 0)
                        from public.stock_count_items i join public.stock_counts c on c.id = i.count_id
                       where c.status = 'completed' and c.completed_at >= v_from and c.completed_at < v_to
                         and i.difference_units < 0),
    'extra_value', (select coalesce(sum(i.difference_cost), 0)
                      from public.stock_count_items i join public.stock_counts c on c.id = i.count_id
                     where c.status = 'completed' and c.completed_at >= v_from and c.completed_at < v_to
                       and i.difference_units > 0),
    'items', coalesce((
      select jsonb_agg(x order by (x ->> 'value')::numeric desc)
        from (
          select jsonb_build_object(
                   'product_id', p.id, 'name', p.name, 'base_unit', p.base_unit_name,
                   'expected', sum(i.expected_units), 'counted', sum(i.counted_units),
                   'difference', sum(i.difference_units), 'value', -sum(coalesce(i.difference_cost, 0)),
                   'cost_missing', bool_or(i.unit_cost is null)) as x
            from public.stock_count_items i
            join public.stock_counts c on c.id = i.count_id
            join public.products p on p.id = i.product_id
           where c.status = 'completed' and c.completed_at >= v_from and c.completed_at < v_to
             and i.difference_units < 0
           group by p.id, p.name, p.base_unit_name) t), '[]'::jsonb),
    'write_offs', coalesce((
      select jsonb_object_agg(reason, value)
        from (select m.reason, -sum(m.change_units * coalesce(m.unit_cost, 0)) as value
                from public.stock_movements m
               where m.reason in ('adjust_damaged', 'adjust_expired', 'adjust_stolen')
                 and m.created_at >= v_from and m.created_at < v_to
               group by m.reason) w), '{}'::jsonb),
    'on_duty', coalesce((
      select jsonb_agg(jsonb_build_object('name', pr.full_name, 'days', d.days, 'sales', d.total) order by d.total desc)
        from (select s.attendant_id,
                     count(distinct (s.created_at at time zone 'Africa/Accra')::date) as days,
                     sum(s.total) as total
                from public.sales s
               where s.status in ('completed', 'refunded') and s.created_at >= v_from and s.created_at < v_to
               group by s.attendant_id) d
        join public.profiles pr on pr.id = d.attendant_id), '[]'::jsonb));
end;
$$;

revoke all on function public.start_stock_count(text, uuid[], text) from public, anon;
revoke all on function public.count_sheet(uuid) from public, anon;
revoke all on function public.submit_count_item(uuid, uuid, integer) from public, anon;
revoke all on function public.complete_stock_count(uuid, boolean) from public, anon;
revoke all on function public.missing_stock_report(date, date) from public, anon;
grant execute on function public.start_stock_count(text, uuid[], text) to authenticated;
grant execute on function public.count_sheet(uuid) to authenticated;
grant execute on function public.submit_count_item(uuid, uuid, integer) to authenticated;
grant execute on function public.complete_stock_count(uuid, boolean) to authenticated;
grant execute on function public.missing_stock_report(date, date) to authenticated;
