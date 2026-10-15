-- =============================================================================
-- Phase 1 · File 3 of 5 · Customers, credit, approvals and sales
-- customers, credit_payments, approval_requests, sales, sale_items,
-- sale_item_costs.
--
-- Cost of goods sold lives in sale_item_costs (owner only), not on sales /
-- sale_items, so attendants can read their own sales without seeing cost or
-- profit. Owner works out a sale's cost_total as the sum of its item costs.
--
-- Sales, items and payments are never deleted. Items and costs are never
-- edited. Sale status changes are made by RPCs (later phases).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- customers (credit_limit 0 = no credit; balance kept by RPCs)
-- -----------------------------------------------------------------------------
create table public.customers (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  name         text not null check (char_length(btrim(name)) between 1 and 120),
  phone        text check (char_length(phone) <= 30),
  type         text not null default 'retail' check (type in ('retail', 'wholesale')),
  credit_limit numeric(12,2) not null default 0 check (credit_limit >= 0),
  balance      numeric(12,2) not null default 0 check (balance >= 0),
  notes        text check (char_length(notes) <= 500),
  is_active    boolean not null default true
);

create index customers_name_idx on public.customers (lower(name));
create index customers_phone_idx on public.customers (phone);
create index customers_owing_idx on public.customers (balance) where balance > 0;

-- -----------------------------------------------------------------------------
-- credit_payments (customer paying back credit)
-- -----------------------------------------------------------------------------
create table public.credit_payments (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  customer_id uuid not null references public.customers (id),
  amount      numeric(12,2) not null check (amount > 0),
  method      text not null check (method in ('cash', 'momo')),
  momo_txn_id text check (char_length(momo_txn_id) <= 64),
  received_by uuid not null references public.profiles (id) default auth.uid(),
  note        text check (char_length(note) <= 500),
  status      text not null default 'completed' check (status in ('completed', 'void')),
  constraint credit_payments_momo_txn check (method <> 'momo' or momo_txn_id is not null)
);

create index credit_payments_customer_idx on public.credit_payments (customer_id, created_at desc);
create index credit_payments_received_by_idx on public.credit_payments (received_by, created_at desc);

-- -----------------------------------------------------------------------------
-- approval_requests (attendant asks, owner decides)
-- payload holds the details, including the attendant's reason.
-- reason = the owner's decision reason.
-- -----------------------------------------------------------------------------
create table public.approval_requests (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  type         text not null check (type in (
                 'discount', 'credit_over_limit', 'refund',
                 'price_change', 'void_sale', 'stock_adjustment')),
  requested_by uuid not null references public.profiles (id) default auth.uid(),
  payload      jsonb not null default '{}'::jsonb,
  status       text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  decided_by   uuid references public.profiles (id),
  decided_at   timestamptz,
  reason       text check (char_length(reason) <= 500),
  constraint approval_requests_decided check ((status = 'pending') = (decided_at is null))
);

create index approval_requests_pending_idx on public.approval_requests (created_at)
  where status = 'pending';
create index approval_requests_requested_by_idx on public.approval_requests (requested_by, created_at desc);

-- -----------------------------------------------------------------------------
-- sales
-- -----------------------------------------------------------------------------
create sequence public.sale_receipt_seq;

create table public.sales (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  receipt_no          text not null unique
                        default ('KP-' || lpad(nextval('public.sale_receipt_seq')::text, 6, '0')),
  attendant_id        uuid not null references public.profiles (id) default auth.uid(),
  customer_id         uuid references public.customers (id),
  price_mode          text not null check (price_mode in ('retail', 'wholesale')),
  subtotal            numeric(12,2) not null check (subtotal >= 0),
  discount            numeric(12,2) not null default 0 check (discount >= 0),
  total               numeric(12,2) not null check (total >= 0),
  paid_cash           numeric(12,2) not null default 0 check (paid_cash >= 0),
  paid_momo           numeric(12,2) not null default 0 check (paid_momo >= 0),
  momo_txn_id         text check (char_length(momo_txn_id) <= 64),
  credit_amount       numeric(12,2) not null default 0 check (credit_amount >= 0),
  change_given        numeric(12,2) not null default 0 check (change_given >= 0),
  status              text not null default 'completed'
                        check (status in ('completed', 'held_for_approval', 'refunded', 'void')),
  approval_request_id uuid references public.approval_requests (id),
  -- The maths must add up, whatever the client sends.
  constraint sales_total_math    check (total = subtotal - discount),
  constraint sales_payment_math  check (paid_cash + paid_momo + credit_amount - change_given = total),
  constraint sales_change_cash   check (change_given <= paid_cash),
  constraint sales_momo_txn      check (paid_momo = 0 or momo_txn_id is not null),
  constraint sales_credit_needs_customer check (credit_amount = 0 or customer_id is not null),
  constraint sales_held_needs_request    check (status <> 'held_for_approval' or approval_request_id is not null)
);

create index sales_created_at_idx on public.sales (created_at desc);
create index sales_attendant_idx on public.sales (attendant_id, created_at desc);
create index sales_customer_idx on public.sales (customer_id, created_at desc) where customer_id is not null;
create index sales_held_idx on public.sales (created_at) where status = 'held_for_approval';

-- -----------------------------------------------------------------------------
-- sale_items (qty in the unit sold; units = base units removed from stock)
-- -----------------------------------------------------------------------------
create table public.sale_items (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  sale_id    uuid not null references public.sales (id),
  product_id uuid not null references public.products (id),
  pack_id    uuid references public.product_packs (id),
  qty        integer not null check (qty > 0),
  units      integer not null check (units > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  line_total numeric(12,2) not null,
  constraint sale_items_line_math check (line_total = qty * unit_price),
  constraint sale_items_units     check (units >= qty)
);

create index sale_items_sale_idx on public.sale_items (sale_id);
create index sale_items_product_idx on public.sale_items (product_id);

-- -----------------------------------------------------------------------------
-- sale_item_costs: cost snapshot per sold line. Owner only.
-- -----------------------------------------------------------------------------
create table public.sale_item_costs (
  sale_item_id uuid primary key references public.sale_items (id),
  created_at   timestamptz not null default now(),
  sale_id      uuid not null references public.sales (id),
  product_id   uuid not null references public.products (id),
  unit_cost    numeric(12,4) not null check (unit_cost >= 0),
  cost_total   numeric(12,2) not null check (cost_total >= 0)
);

create index sale_item_costs_sale_idx on public.sale_item_costs (sale_id);
create index sale_item_costs_product_idx on public.sale_item_costs (product_id);

-- -----------------------------------------------------------------------------
-- Permanent records
-- -----------------------------------------------------------------------------
create trigger sales_no_delete
  before delete on public.sales
  for each row execute function public.prevent_change();
create trigger sales_no_truncate
  before truncate on public.sales
  for each statement execute function public.prevent_change();

create trigger sale_items_no_update_delete
  before update or delete on public.sale_items
  for each row execute function public.prevent_change();
create trigger sale_items_no_truncate
  before truncate on public.sale_items
  for each statement execute function public.prevent_change();

create trigger sale_item_costs_no_update_delete
  before update or delete on public.sale_item_costs
  for each row execute function public.prevent_change();
create trigger sale_item_costs_no_truncate
  before truncate on public.sale_item_costs
  for each statement execute function public.prevent_change();

create trigger credit_payments_no_delete
  before delete on public.credit_payments
  for each row execute function public.prevent_change();
create trigger credit_payments_no_truncate
  before truncate on public.credit_payments
  for each statement execute function public.prevent_change();

create trigger approval_requests_no_delete
  before delete on public.approval_requests
  for each row execute function public.prevent_change();

-- Audit: customer details and credit limits (balance is logged by RPCs).
create trigger customers_audit
  after insert or update on public.customers
  for each row execute function public.audit_row_change('balance');

-- -----------------------------------------------------------------------------
-- Row level security
-- -----------------------------------------------------------------------------
alter table public.customers         enable row level security;
alter table public.credit_payments   enable row level security;
alter table public.approval_requests enable row level security;
alter table public.sales             enable row level security;
alter table public.sale_items        enable row level security;
alter table public.sale_item_costs   enable row level security;

-- customers: staff can look up and add customers (to give credit at the
-- till), but only the owner can set a credit limit above 0 or edit.
create policy "Staff read customers"
  on public.customers for select to authenticated
  using ((select public.is_staff()));
create policy "Staff add customers, only owner sets credit limit"
  on public.customers for insert to authenticated
  with check ((select public.is_owner()) or ((select public.is_staff()) and credit_limit = 0));
create policy "Owner edits customers"
  on public.customers for update to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));

create policy "Owner sees all repayments, staff see own"
  on public.credit_payments for select to authenticated
  using ((select public.is_owner())
         or ((select public.is_staff()) and received_by = (select auth.uid())));

create policy "Owner sees all requests, staff see own"
  on public.approval_requests for select to authenticated
  using ((select public.is_owner())
         or ((select public.is_staff()) and requested_by = (select auth.uid())));

create policy "Owner sees all sales, attendants see own"
  on public.sales for select to authenticated
  using ((select public.is_owner())
         or ((select public.is_staff()) and attendant_id = (select auth.uid())));

-- Items are visible when their sale is visible (sales RLS applies inside).
create policy "Sale items follow their sale"
  on public.sale_items for select to authenticated
  using (exists (select 1 from public.sales s where s.id = sale_items.sale_id));

create policy "Owner reads sale costs"
  on public.sale_item_costs for select to authenticated
  using ((select public.is_owner()));

-- -----------------------------------------------------------------------------
-- Privileges. Sales, payments and requests are written by RPCs only.
-- -----------------------------------------------------------------------------
revoke all on table public.customers, public.credit_payments, public.approval_requests,
                    public.sales, public.sale_items, public.sale_item_costs
  from anon, authenticated;
revoke all on sequence public.sale_receipt_seq from anon, authenticated;

grant select on public.customers to authenticated;
grant insert (name, phone, type, notes, credit_limit) on public.customers to authenticated;
grant update (name, phone, type, notes, credit_limit, is_active) on public.customers to authenticated;

grant select on public.credit_payments   to authenticated;
grant select on public.approval_requests to authenticated;
grant select on public.sales             to authenticated;
grant select on public.sale_items        to authenticated;
grant select on public.sale_item_costs   to authenticated;
