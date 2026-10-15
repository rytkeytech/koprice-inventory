-- =============================================================================
-- Phase 1 · File 2 of 5 · Catalogue and stock ledger
-- categories, products, product_packs, product_costs, stock_movements.
--
-- Stock rule: products.stock_units can ONLY change by inserting a row into
-- stock_movements. A trigger on stock_movements locks the product, checks
-- stock won't go negative, updates stock_units and fills balance_after.
-- A guard trigger on products rejects any other change to stock_units.
--
-- Unit costs use numeric(12,4): a bag of 30 sachets at GH₵ 5.50 is
-- GH₵ 0.1833 per sachet, and 2 decimals would distort stock value.
-- Totals stay numeric(12,2).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- categories
-- -----------------------------------------------------------------------------
create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name       text not null check (char_length(btrim(name)) between 1 and 60),
  sort_order integer not null default 0,
  is_active  boolean not null default true
);

create unique index categories_name_key on public.categories (lower(name));

-- -----------------------------------------------------------------------------
-- products (stock is always in base units)
-- -----------------------------------------------------------------------------
create table public.products (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  name              text not null check (char_length(btrim(name)) between 1 and 120),
  category_id       uuid references public.categories (id),
  brand             text check (char_length(brand) <= 80),
  base_unit_name    text not null default 'piece'
                      check (char_length(btrim(base_unit_name)) between 1 and 30),
  barcode           text unique
                      check (barcode is null or (barcode = btrim(barcode) and char_length(barcode) between 1 and 64)),
  retail_price      numeric(12,2) not null check (retail_price > 0),
  wholesale_price   numeric(12,2) not null check (wholesale_price > 0),
  min_wholesale_qty integer not null default 1 check (min_wholesale_qty >= 1),
  stock_units       integer not null default 0 check (stock_units >= 0),
  reorder_level     integer not null default 0 check (reorder_level >= 0),
  is_quick_sell     boolean not null default false,
  photo_url         text,
  track_expiry      boolean not null default false,
  is_active         boolean not null default true
);

create index products_category_id_idx on public.products (category_id);
create index products_name_idx on public.products (lower(name));

-- -----------------------------------------------------------------------------
-- product_packs (e.g. Bag = 30 sachets)
-- -----------------------------------------------------------------------------
create table public.product_packs (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  product_id        uuid not null references public.products (id),
  name              text not null check (char_length(btrim(name)) between 1 and 40),
  units_per_pack    integer not null check (units_per_pack > 1),
  barcode           text unique
                      check (barcode is null or (barcode = btrim(barcode) and char_length(barcode) between 1 and 64)),
  retail_price      numeric(12,2) not null check (retail_price > 0),
  wholesale_price   numeric(12,2) not null check (wholesale_price > 0),
  min_wholesale_qty integer not null default 1 check (min_wholesale_qty >= 1),
  is_quick_sell     boolean not null default false,
  is_active         boolean not null default true
);

create index product_packs_product_id_idx on public.product_packs (product_id);
create unique index product_packs_name_key on public.product_packs (product_id, lower(name));

-- A barcode must be unique across products AND packs, so a scan finds one item.
create function public.check_barcode_unique()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.barcode is null then
    return new;
  end if;

  if tg_table_name = 'products'
     and exists (select 1 from public.product_packs pp where pp.barcode = new.barcode) then
    raise exception 'Barcode % is already used by a pack', new.barcode using errcode = '23505';
  elsif tg_table_name = 'product_packs'
     and exists (select 1 from public.products p where p.barcode = new.barcode) then
    raise exception 'Barcode % is already used by a product', new.barcode using errcode = '23505';
  end if;

  return new;
end;
$$;

create trigger products_barcode_unique
  before insert or update of barcode on public.products
  for each row execute function public.check_barcode_unique();

create trigger product_packs_barcode_unique
  before insert or update of barcode on public.product_packs
  for each row execute function public.check_barcode_unique();

-- -----------------------------------------------------------------------------
-- product_costs: cost per BASE unit. Owner only; attendants cannot select it.
-- -----------------------------------------------------------------------------
create table public.product_costs (
  product_id    uuid primary key references public.products (id),
  created_at    timestamptz not null default now(),
  cost_per_unit numeric(12,4) not null check (cost_per_unit >= 0),
  updated_at    timestamptz not null default now(),
  updated_by    uuid references public.profiles (id) default auth.uid()
);

create function public.touch_product_cost()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

create trigger product_costs_touch
  before update on public.product_costs
  for each row execute function public.touch_product_cost();

-- -----------------------------------------------------------------------------
-- stock_movements: the ledger. Every stock change is one row here.
-- -----------------------------------------------------------------------------
create table public.stock_movements (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  product_id    uuid not null references public.products (id),
  change_units  integer not null check (change_units <> 0),
  balance_after integer not null check (balance_after >= 0),
  reason        text not null check (reason in (
                  'sale', 'delivery', 'refund',
                  'adjust_damaged', 'adjust_expired', 'adjust_stolen',
                  'count_correction', 'opening_stock', 'import')),
  ref_table     text,
  ref_id        uuid,
  unit_cost     numeric(12,4) check (unit_cost >= 0),
  user_id       uuid references public.profiles (id) default auth.uid(),
  note          text check (char_length(note) <= 500),
  -- The direction must match the reason (a "sale" can't add stock, etc.)
  constraint stock_movements_direction check (
       (reason = 'sale' and change_units < 0)
    or (reason in ('delivery', 'refund', 'opening_stock', 'import') and change_units > 0)
    or (reason in ('adjust_damaged', 'adjust_expired', 'adjust_stolen') and change_units < 0)
    or reason = 'count_correction'
  )
);

create index stock_movements_product_idx on public.stock_movements (product_id, created_at desc);
create index stock_movements_created_at_idx on public.stock_movements (created_at desc);
create index stock_movements_ref_idx on public.stock_movements (ref_table, ref_id);

-- Applies a movement to products.stock_units (same transaction).
create function public.apply_stock_movement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_units integer;
  product_name  text;
begin
  select p.stock_units, p.name
    into current_units, product_name
    from public.products p
   where p.id = new.product_id
     for update;

  if not found then
    raise exception 'Product % not found', new.product_id using errcode = '23503';
  end if;

  if current_units + new.change_units < 0 then
    raise exception 'Not enough stock for %: % in stock, % needed',
      product_name, current_units, -new.change_units
      using errcode = '23514';
  end if;

  perform set_config('koprice.allow_stock_write', 'on', true);
  update public.products
     set stock_units = current_units + new.change_units
   where id = new.product_id;
  perform set_config('koprice.allow_stock_write', 'off', true);

  new.balance_after := current_units + new.change_units;

  -- Snapshot the current cost so stock value can be worked out later.
  if new.unit_cost is null then
    select c.cost_per_unit into new.unit_cost
      from public.product_costs c
     where c.product_id = new.product_id;
  end if;

  return new;
end;
$$;

create trigger stock_movements_apply
  before insert on public.stock_movements
  for each row execute function public.apply_stock_movement();

create trigger stock_movements_no_update_delete
  before update or delete on public.stock_movements
  for each row execute function public.prevent_change();

create trigger stock_movements_no_truncate
  before truncate on public.stock_movements
  for each statement execute function public.prevent_change();

-- Rejects stock changes that don't come from a stock movement.
create function public.guard_stock_units()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.stock_units <> 0 then
      raise exception 'New products start with 0 stock. Add opening stock as a stock movement.'
        using errcode = '42501';
    end if;
  elsif new.stock_units is distinct from old.stock_units
        and coalesce(current_setting('koprice.allow_stock_write', true), 'off') <> 'on' then
    raise exception 'Stock can only change through a stock movement.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger products_guard_stock
  before insert or update on public.products
  for each row execute function public.guard_stock_units();

-- -----------------------------------------------------------------------------
-- Audit: price, cost and catalogue changes
-- -----------------------------------------------------------------------------
create trigger categories_audit
  after insert or update on public.categories
  for each row execute function public.audit_row_change();

create trigger products_audit
  after insert or update on public.products
  for each row execute function public.audit_row_change('stock_units');

create trigger product_packs_audit
  after insert or update on public.product_packs
  for each row execute function public.audit_row_change();

create trigger product_costs_audit
  after insert or update on public.product_costs
  for each row execute function public.audit_row_change('updated_at', 'updated_by');

-- -----------------------------------------------------------------------------
-- Row level security
-- -----------------------------------------------------------------------------
alter table public.categories      enable row level security;
alter table public.products        enable row level security;
alter table public.product_packs   enable row level security;
alter table public.product_costs   enable row level security;
alter table public.stock_movements enable row level security;

create policy "Staff read categories"
  on public.categories for select to authenticated
  using ((select public.is_staff()));
create policy "Owner adds categories"
  on public.categories for insert to authenticated
  with check ((select public.is_owner()));
create policy "Owner edits categories"
  on public.categories for update to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));

create policy "Staff read products"
  on public.products for select to authenticated
  using ((select public.is_staff()));
create policy "Owner adds products"
  on public.products for insert to authenticated
  with check ((select public.is_owner()));
create policy "Owner edits products"
  on public.products for update to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));

create policy "Staff read packs"
  on public.product_packs for select to authenticated
  using ((select public.is_staff()));
create policy "Owner adds packs"
  on public.product_packs for insert to authenticated
  with check ((select public.is_owner()));
create policy "Owner edits packs"
  on public.product_packs for update to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));

create policy "Owner reads costs"
  on public.product_costs for select to authenticated
  using ((select public.is_owner()));
create policy "Owner adds costs"
  on public.product_costs for insert to authenticated
  with check ((select public.is_owner()));
create policy "Owner edits costs"
  on public.product_costs for update to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));

create policy "Owner reads stock movements"
  on public.stock_movements for select to authenticated
  using ((select public.is_owner()));
-- No insert/update/delete policies: movements are written by RPCs only.

-- -----------------------------------------------------------------------------
-- Privileges. stock_units is deliberately NOT in any insert/update grant.
-- -----------------------------------------------------------------------------
revoke all on table public.categories, public.products, public.product_packs,
                    public.product_costs, public.stock_movements
  from anon, authenticated;

grant select on public.categories to authenticated;
grant insert (name, sort_order, is_active) on public.categories to authenticated;
grant update (name, sort_order, is_active) on public.categories to authenticated;

grant select on public.products to authenticated;
grant insert (name, category_id, brand, base_unit_name, barcode, retail_price, wholesale_price,
              min_wholesale_qty, reorder_level, is_quick_sell, photo_url, track_expiry, is_active)
  on public.products to authenticated;
grant update (name, category_id, brand, base_unit_name, barcode, retail_price, wholesale_price,
              min_wholesale_qty, reorder_level, is_quick_sell, photo_url, track_expiry, is_active)
  on public.products to authenticated;

grant select on public.product_packs to authenticated;
grant insert (product_id, name, units_per_pack, barcode, retail_price, wholesale_price,
              min_wholesale_qty, is_quick_sell, is_active)
  on public.product_packs to authenticated;
grant update (name, units_per_pack, barcode, retail_price, wholesale_price,
              min_wholesale_qty, is_quick_sell, is_active)
  on public.product_packs to authenticated;

grant select on public.product_costs to authenticated;
grant insert (product_id, cost_per_unit) on public.product_costs to authenticated;
grant update (cost_per_unit) on public.product_costs to authenticated;

grant select on public.stock_movements to authenticated;

revoke all on function public.check_barcode_unique() from public, anon, authenticated;
revoke all on function public.touch_product_cost()   from public, anon, authenticated;
revoke all on function public.apply_stock_movement() from public, anon, authenticated;
revoke all on function public.guard_stock_units()    from public, anon, authenticated;
