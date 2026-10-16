-- =============================================================================
-- Phase 10 · Owner home and reports (owner only, read-only)
--   owner_dashboard(from, to)   headline money, alerts, signals of loss
--   sales_report(from, to)      daily sales, best sellers, slow movers, staff
-- Dates are Accra calendar days, inclusive. Revenue and profit count
-- COMPLETED sales only (refunded and cancelled sales are excluded).
-- =============================================================================

create function public.owner_dashboard(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_from     timestamptz := (p_from::timestamp at time zone 'Africa/Accra');
  v_to       timestamptz := ((p_to + 1)::timestamp at time zone 'Africa/Accra');
  v_default  integer := coalesce((select low_stock_default from public.shop_settings limit 1), 10);
  v_days     integer := p_to - p_from + 1;
  v_result   jsonb;
begin
  if not public.is_owner() then
    raise exception 'Only the owner can see this' using errcode = '42501';
  end if;

  with sales as (
    select * from public.sales where created_at >= v_from and created_at < v_to
  ),
  done as (
    select * from sales where status = 'completed'
  ),
  costs as (
    select coalesce(sum(c.cost_total), 0) as cost
      from public.sale_item_costs c join done d on d.id = c.sale_id
  ),
  missing_cost as (
    select count(*) as n
      from public.sale_item_costs c join done d on d.id = c.sale_id
     where c.unit_cost = 0
  )
  select jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'sales_total',  (select coalesce(sum(total), 0) from done),
    'sales_count',  (select count(*) from done),
    'cash',         (select coalesce(sum(paid_cash - change_given), 0) from done),
    'momo',         (select coalesce(sum(paid_momo), 0) from done),
    'credit',       (select coalesce(sum(credit_amount), 0) from done),
    'retail',       (select coalesce(sum(total), 0) from done where price_mode = 'retail'),
    'wholesale',    (select coalesce(sum(total), 0) from done where price_mode = 'wholesale'),
    'cost_total',   (select cost from costs),
    'profit',       (select coalesce(sum(total), 0) from done) - (select cost from costs),
    'lines_without_cost', (select n from missing_cost),
    'expenses',     (select coalesce(sum(amount), 0) from public.expenses
                      where status = 'confirmed' and expense_date between p_from and p_to),
    'repaid',       (select coalesce(sum(amount), 0) from public.credit_payments
                      where status = 'completed' and created_at >= v_from and created_at < v_to),
    'per_attendant', coalesce((
      select jsonb_agg(jsonb_build_object('id', a.attendant_id, 'name', p.full_name, 'total', a.total, 'count', a.n,
                                          'avg_daily_before', a.avg_before)
                       order by a.total desc)
        from (
          select d.attendant_id, sum(d.total) as total, count(*) as n,
                 -- Their average sales per working day in the 28 days before this period.
                 (select round(avg(day_total), 2) from (
                    select sum(s2.total) as day_total
                      from public.sales s2
                     where s2.attendant_id = d.attendant_id and s2.status = 'completed'
                       and s2.created_at >= v_from - interval '28 days' and s2.created_at < v_from
                     group by (s2.created_at at time zone 'Africa/Accra')::date) x) as avg_before
            from done d group by d.attendant_id) a
        join public.profiles p on p.id = a.attendant_id), '[]'::jsonb),
    'money_owed',   (select coalesce(sum(balance), 0) from public.customers where balance > 0),
    'debtors',      (select count(*) from public.customers where balance > 0),
    'low_stock',    (select count(*) from public.products
                      where is_active and stock_units <= case when reorder_level > 0 then reorder_level else v_default end),
    'stock_value',  (select coalesce(sum(p.stock_units * coalesce(c.cost_per_unit, 0)), 0)
                       from public.products p left join public.product_costs c on c.product_id = p.id
                      where p.is_active),
    'pending', jsonb_build_object(
      'requests',   (select count(*) from public.approval_requests where status = 'pending'),
      'deliveries', (select count(*) from public.deliveries where status = 'pending_check'),
      'cash_ups',   (select count(*) from public.cash_ups where status = 'submitted'),
      'expenses',   (select count(*) from public.expenses where status = 'pending')),
    'missing_value', (select coalesce(-sum(i.difference_cost), 0)
                        from public.stock_count_items i join public.stock_counts c on c.id = i.count_id
                       where c.status = 'completed' and c.completed_at >= v_from and c.completed_at < v_to
                         and i.difference_units < 0),
    'shortages',    (select coalesce(sum(shortage), 0) from public.cash_ups
                      where status = 'short' and business_date between p_from and p_to),
    -- Things the owner should look at: possible signs of loss.
    'signals', jsonb_build_object(
      'discounts',       (select count(*) from done where discount > 0),
      'discount_total',  (select coalesce(sum(discount), 0) from done),
      'refunds',         (select count(*) from public.sales where status = 'refunded' and reversed_at >= v_from and reversed_at < v_to),
      'voids',           (select count(*) from public.sales where status = 'void' and reversed_at >= v_from and reversed_at < v_to),
      'held',            (select count(*) from sales where status = 'held_for_approval'),
      'adjustments',     (select count(*) from public.stock_movements
                           where reason in ('adjust_damaged', 'adjust_expired', 'adjust_stolen')
                             and created_at >= v_from and created_at < v_to),
      'write_off_value', (select coalesce(-sum(change_units * coalesce(unit_cost, 0)), 0) from public.stock_movements
                           where reason in ('adjust_damaged', 'adjust_expired', 'adjust_stolen')
                             and created_at >= v_from and created_at < v_to),
      'over_limit',      (select count(*) from public.audit_logs
                           where action = 'sale_with_override' and (details ->> 'over_limit')::boolean
                             and created_at >= v_from and created_at < v_to)),
    'days', v_days
  ) into v_result;

  return v_result;
end;
$$;

create function public.sales_report(p_from date, p_to date)
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
    raise exception 'Only the owner can see reports' using errcode = '42501';
  end if;
  if p_to < p_from or p_to - p_from > 366 then
    raise exception 'Choose a period of up to one year' using errcode = '22023';
  end if;

  return jsonb_build_object(
    'daily', (
      select jsonb_agg(jsonb_build_object('date', d.day, 'retail', coalesce(s.retail, 0), 'wholesale', coalesce(s.wholesale, 0),
                                          'count', coalesce(s.n, 0)) order by d.day)
        from generate_series(p_from, p_to, interval '1 day') as d(day)
        left join (
          select (created_at at time zone 'Africa/Accra')::date as day,
                 sum(total) filter (where price_mode = 'retail') as retail,
                 sum(total) filter (where price_mode = 'wholesale') as wholesale,
                 count(*) as n
            from public.sales
           where status = 'completed' and created_at >= v_from and created_at < v_to
           group by 1) s on s.day = d.day::date),
    'best_sellers', coalesce((
      select jsonb_agg(x order by (x ->> 'revenue')::numeric desc)
        from (
          select jsonb_build_object('product_id', p.id, 'name', p.name, 'base_unit', p.base_unit_name,
                                    'units', sum(si.units), 'revenue', sum(si.line_total),
                                    'cost', sum(coalesce(c.cost_total, 0)),
                                    'profit', sum(si.line_total) - sum(coalesce(c.cost_total, 0))) as x
            from public.sale_items si
            join public.sales s on s.id = si.sale_id
            join public.products p on p.id = si.product_id
            left join public.sale_item_costs c on c.sale_item_id = si.id
           where s.status = 'completed' and s.created_at >= v_from and s.created_at < v_to
           group by p.id, p.name, p.base_unit_name
           order by sum(si.line_total) desc
           limit 20) t), '[]'::jsonb),
    'slow_movers', coalesce((
      select jsonb_agg(x order by (x ->> 'stock_value')::numeric desc)
        from (
          select jsonb_build_object('product_id', p.id, 'name', p.name, 'base_unit', p.base_unit_name,
                                    'stock_units', p.stock_units,
                                    'stock_value', p.stock_units * coalesce(c.cost_per_unit, 0),
                                    'last_sold', (select max(s.created_at) from public.sale_items si
                                                    join public.sales s on s.id = si.sale_id
                                                   where si.product_id = p.id and s.status = 'completed')) as x
            from public.products p
            left join public.product_costs c on c.product_id = p.id
           where p.is_active and p.stock_units > 0
             and not exists (select 1 from public.sale_items si join public.sales s on s.id = si.sale_id
                              where si.product_id = p.id and s.status = 'completed'
                                and s.created_at >= v_from and s.created_at < v_to)
           order by p.stock_units * coalesce(c.cost_per_unit, 0) desc
           limit 20) t), '[]'::jsonb),
    'attendants', coalesce((
      select jsonb_agg(jsonb_build_object('name', pr.full_name, 'total', a.total, 'count', a.n,
                                          'discounts', a.discounts, 'credit', a.credit,
                                          'days', a.days, 'refunds_voids', a.reversed) order by a.total desc)
        from (select attendant_id,
                     sum(total) filter (where status = 'completed') as total,
                     count(*) filter (where status = 'completed') as n,
                     coalesce(sum(discount) filter (where status = 'completed'), 0) as discounts,
                     coalesce(sum(credit_amount) filter (where status = 'completed'), 0) as credit,
                     count(distinct (created_at at time zone 'Africa/Accra')::date) as days,
                     count(*) filter (where status in ('refunded', 'void')) as reversed
                from public.sales
               where created_at >= v_from and created_at < v_to
               group by attendant_id) a
        join public.profiles pr on pr.id = a.attendant_id), '[]'::jsonb),
    'credit_given', (select coalesce(sum(credit_amount), 0) from public.sales
                      where status = 'completed' and created_at >= v_from and created_at < v_to),
    'credit_repaid', (select coalesce(sum(amount), 0) from public.credit_payments
                       where status = 'completed' and created_at >= v_from and created_at < v_to),
    'expenses', coalesce((
      select jsonb_object_agg(category, total)
        from (select category, sum(amount) as total from public.expenses
               where status = 'confirmed' and expense_date between p_from and p_to
               group by category) e), '{}'::jsonb));
end;
$$;

revoke all on function public.owner_dashboard(date, date) from public, anon;
revoke all on function public.sales_report(date, date) from public, anon;
grant execute on function public.owner_dashboard(date, date) to authenticated;
grant execute on function public.sales_report(date, date) to authenticated;
