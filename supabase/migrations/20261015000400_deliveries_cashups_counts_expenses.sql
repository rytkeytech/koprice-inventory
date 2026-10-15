-- =============================================================================
-- Phase 1 · File 4 of 5 · Deliveries, cash-ups, stock counts, expenses
-- suppliers, deliveries, delivery_items, delivery_item_costs, cash_ups,
-- stock_counts, stock_count_items, expenses.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- suppliers
-- -----------------------------------------------------------------------------
create table public.suppliers (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  name         text not null check (char_length(btrim(name)) between 1 and 120),
  phone        text check (char_length(phone) <= 30),
  notes        text check (char_length(notes) <= 500),
  balance_owed numeric(12,2) not null default 0 check (balance_owed >= 0), -- phase 2
  is_active    boolean not null default true
);

create unique index suppliers_name_key on public.suppliers (lower(name));

-- -----------------------------------------------------------------------------
-- deliveries: stock goes up when saved; owner later confirms or queries.
-- -----------------------------------------------------------------------------
create table public.deliveries (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  supplier_id       uuid references public.suppliers (id),
  received_by       uuid not null references public.profiles (id) default auth.uid(),
  invoice_photo_url text,
  status            text not null default 'pending_check'
                      check (status in ('pending_check', 'confirmed', 'queried')),
  checked_by        uuid references public.profiles (id),
  checked_at        timestamptz,
  note              text check (char_length(note) <= 500),
  constraint deliveries_checked check ((status = 'pending_check') = (checked_at is null))
);

create index deliveries_status_idx on public.deliveries (status, created_at desc);
create index deliveries_received_by_idx on public.deliveries (received_by, created_at desc);
create index deliveries_supplier_idx on public.deliveries (supplier_id);

create table public.delivery_items (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  delivery_id uuid not null references public.deliveries (id),
  product_id  uuid not null references public.products (id),
  pack_id     uuid references public.product_packs (id),
  qty         integer not null check (qty > 0),
  units       integer not null check (units > 0),
  constraint delivery_items_units check (units >= qty)
);

create index delivery_items_delivery_idx on public.delivery_items (delivery_id);
create index delivery_items_product_idx on public.delivery_items (product_id);

-- Cost per base unit, set by the owner when confirming. Owner only.
create table public.delivery_item_costs (
  delivery_item_id uuid primary key references public.delivery_items (id),
  created_at       timestamptz not null default now(),
  delivery_id      uuid not null references public.deliveries (id),
  unit_cost        numeric(12,4) not null check (unit_cost >= 0),
  set_by           uuid references public.profiles (id) default auth.uid()
);

create index delivery_item_costs_delivery_idx on public.delivery_item_costs (delivery_id);

-- -----------------------------------------------------------------------------
-- cash_ups: one per attendant per business day.
-- Expected figures are computed by the submit_cash_up RPC, not typed in.
-- shortage = expected_cash - confirmed_amount (positive = money missing).
-- -----------------------------------------------------------------------------
create table public.cash_ups (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  attendant_id     uuid not null references public.profiles (id) default auth.uid(),
  business_date    date not null default public.accra_today(),
  expected_cash    numeric(12,2) not null default 0 check (expected_cash >= 0),
  expected_momo    numeric(12,2) not null default 0 check (expected_momo >= 0),
  credit_given     numeric(12,2) not null default 0 check (credit_given >= 0),
  handover_method  text not null check (handover_method in ('momo', 'safe')),
  amount_handed    numeric(12,2) not null check (amount_handed >= 0),
  momo_txn_id      text check (char_length(momo_txn_id) <= 64),
  status           text not null default 'submitted' check (status in ('submitted', 'confirmed', 'short')),
  confirmed_by     uuid references public.profiles (id),
  confirmed_at     timestamptz,
  confirmed_amount numeric(12,2) check (confirmed_amount >= 0),
  shortage         numeric(12,2) generated always as (expected_cash - confirmed_amount) stored,
  note             text check (char_length(note) <= 500),
  constraint cash_ups_one_per_day unique (attendant_id, business_date),
  constraint cash_ups_momo_txn check (handover_method <> 'momo' or amount_handed = 0 or momo_txn_id is not null),
  constraint cash_ups_confirmed check ((status = 'submitted') = (confirmed_at is null))
);

create index cash_ups_status_idx on public.cash_ups (status, business_date desc);
create index cash_ups_business_date_idx on public.cash_ups (business_date desc);

-- -----------------------------------------------------------------------------
-- stock counts
-- Attendants can see that a count is open, but count items (expected
-- quantities and cost) are owner only, so counting is "blind".
-- -----------------------------------------------------------------------------
create table public.stock_counts (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  type         text not null check (type in ('spot', 'full')),
  started_by   uuid not null references public.profiles (id) default auth.uid(),
  status       text not null default 'open' check (status in ('open', 'completed')),
  completed_at timestamptz,
  corrections_applied boolean not null default false,
  note         text check (char_length(note) <= 500),
  constraint stock_counts_completed check ((status = 'completed') = (completed_at is not null))
);

create index stock_counts_status_idx on public.stock_counts (status, created_at desc);

create table public.stock_count_items (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  count_id         uuid not null references public.stock_counts (id),
  product_id       uuid not null references public.products (id),
  expected_units   integer not null,
  unit_cost        numeric(12,4) check (unit_cost >= 0),
  counted_units    integer check (counted_units >= 0),
  counted_by       uuid references public.profiles (id),
  counted_at       timestamptz,
  difference_units integer generated always as (counted_units - expected_units) stored,
  difference_cost  numeric(12,2)
                     generated always as (round((counted_units - expected_units) * unit_cost, 2)) stored,
  constraint stock_count_items_one_per_product unique (count_id, product_id)
);

create index stock_count_items_product_idx on public.stock_count_items (product_id);

-- -----------------------------------------------------------------------------
-- expenses: owner adds directly; attendants add as 'pending' for the owner.
-- -----------------------------------------------------------------------------
create table public.expenses (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  expense_date      date not null default public.accra_today(),
  category          text not null check (category in ('rent', 'electricity', 'transport', 'salary', 'other')),
  amount            numeric(12,2) not null check (amount > 0),
  paid_by           uuid not null references public.profiles (id) default auth.uid(),
  note              text check (char_length(note) <= 500),
  receipt_photo_url text,
  status            text not null default 'pending' check (status in ('pending', 'confirmed', 'rejected')),
  confirmed_by      uuid references public.profiles (id),
  confirmed_at      timestamptz
);

create index expenses_date_idx on public.expenses (expense_date desc);
create index expenses_pending_idx on public.expenses (created_at) where status = 'pending';

-- -----------------------------------------------------------------------------
-- Permanent records
-- -----------------------------------------------------------------------------
create trigger deliveries_no_delete
  before delete on public.deliveries
  for each row execute function public.prevent_change();
create trigger delivery_items_no_delete
  before delete on public.delivery_items
  for each row execute function public.prevent_change();
create trigger cash_ups_no_delete
  before delete on public.cash_ups
  for each row execute function public.prevent_change();
create trigger cash_ups_no_truncate
  before truncate on public.cash_ups
  for each statement execute function public.prevent_change();
create trigger stock_counts_no_delete
  before delete on public.stock_counts
  for each row execute function public.prevent_change();
create trigger stock_count_items_no_delete
  before delete on public.stock_count_items
  for each row execute function public.prevent_change();
create trigger expenses_no_delete
  before delete on public.expenses
  for each row execute function public.prevent_change();

-- Audit
create trigger suppliers_audit
  after insert or update on public.suppliers
  for each row execute function public.audit_row_change('balance_owed');
create trigger expenses_audit
  after insert or update on public.expenses
  for each row execute function public.audit_row_change();

-- -----------------------------------------------------------------------------
-- Row level security
-- -----------------------------------------------------------------------------
alter table public.suppliers           enable row level security;
alter table public.deliveries          enable row level security;
alter table public.delivery_items      enable row level security;
alter table public.delivery_item_costs enable row level security;
alter table public.cash_ups            enable row level security;
alter table public.stock_counts        enable row level security;
alter table public.stock_count_items   enable row level security;
alter table public.expenses            enable row level security;

create policy "Staff read suppliers"
  on public.suppliers for select to authenticated
  using ((select public.is_staff()));
create policy "Staff add suppliers"
  on public.suppliers for insert to authenticated
  with check ((select public.is_staff()));
create policy "Owner edits suppliers"
  on public.suppliers for update to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));

create policy "Owner sees all deliveries, staff see own"
  on public.deliveries for select to authenticated
  using ((select public.is_owner())
         or ((select public.is_staff()) and received_by = (select auth.uid())));

create policy "Delivery items follow their delivery"
  on public.delivery_items for select to authenticated
  using (exists (select 1 from public.deliveries d where d.id = delivery_items.delivery_id));

create policy "Owner reads delivery costs"
  on public.delivery_item_costs for select to authenticated
  using ((select public.is_owner()));

create policy "Owner sees all cash-ups, attendants see own"
  on public.cash_ups for select to authenticated
  using ((select public.is_owner())
         or ((select public.is_staff()) and attendant_id = (select auth.uid())));

create policy "Owner sees all counts, staff see open counts"
  on public.stock_counts for select to authenticated
  using ((select public.is_owner())
         or ((select public.is_staff()) and status = 'open'));

create policy "Owner reads count items"
  on public.stock_count_items for select to authenticated
  using ((select public.is_owner()));

create policy "Owner sees all expenses, staff see own"
  on public.expenses for select to authenticated
  using ((select public.is_owner())
         or ((select public.is_staff()) and paid_by = (select auth.uid())));
create policy "Owner adds expenses, staff add pending ones"
  on public.expenses for insert to authenticated
  with check ((select public.is_owner())
              or ((select public.is_staff()) and status = 'pending'));
create policy "Owner edits expenses"
  on public.expenses for update to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));

-- -----------------------------------------------------------------------------
-- Privileges
-- -----------------------------------------------------------------------------
revoke all on table public.suppliers, public.deliveries, public.delivery_items,
                    public.delivery_item_costs, public.cash_ups, public.stock_counts,
                    public.stock_count_items, public.expenses
  from anon, authenticated;

grant select on public.suppliers to authenticated;
grant insert (name, phone, notes) on public.suppliers to authenticated;
grant update (name, phone, notes, is_active) on public.suppliers to authenticated;

grant select on public.deliveries          to authenticated;
grant select on public.delivery_items      to authenticated;
grant select on public.delivery_item_costs to authenticated;
grant select on public.cash_ups            to authenticated;
grant select on public.stock_counts        to authenticated;
grant select on public.stock_count_items   to authenticated;

grant select on public.expenses to authenticated;
grant insert (expense_date, category, amount, note, receipt_photo_url, status)
  on public.expenses to authenticated;
grant update (expense_date, category, amount, note, receipt_photo_url, status)
  on public.expenses to authenticated;
