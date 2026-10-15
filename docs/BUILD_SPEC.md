# Koprice Inventory & Sales System — Build Spec

Prepared by RYT KEY TECH (Annor Sampson · 0549572669 · rytkeytech@gmail.com) for Koprice Enterprise (Prince Akoto · 0248761268), Esreso Ophilia, Ghana.

---

## 1. The business

- Mini supermarket selling **retail and wholesale**: sachet water, bottled water, soaps, canned goods, drinks, polythene bags, provisions and more.
- **No fixed counter.** Shop attendants sell using **shop-owned Android phones** (and possibly one tablet).
- **The owner (Prince) works elsewhere** and visits sometimes. He must be able to see and control everything remotely.
- **Credit** is given to both retail and wholesale customers.
- **Main goal: prevent loss.** Track every sale, every stock movement and every cedi so the owner can see if anything is missing and whether the business is growing.

## 2. Roles

Only two roles:

| Role | Who | Can |
|---|---|---|
| `owner` | Prince | Everything. Sees cost, profit, reports. Approves requests. Confirms deliveries and cash-ups. Manages products, prices, staff, settings. |
| `attendant` | Shop staff | Sell, receive goods (pending owner check), close their day, view their own day's sales, request approvals. **Cannot** see cost/profit, change prices, give discount, refund, delete, or exceed credit limits. |

Signup flow: new accounts get **no role** → see a "Waiting for owner approval" screen → owner assigns role in Settings › Staff → approves. Owner can deactivate staff (never delete).

## 3. Units, packs and prices

Many items sell both single and in bulk. Model:

- Each product has a **base unit** (e.g. sachet, bottle, bar, tin, piece). **Stock is always stored in base units** (`products.stock_units`, integer).
- A product can have **packs** (`product_packs`): e.g. "Bag" = 30 sachets, "Carton" = 24 tins, "Crate" = 24 bottles, "Bundle" = 100 polythene.
- Each sellable option (the base unit itself, and each pack) has its own **retail price** and **wholesale price**.
- Wholesale price may have a **minimum quantity** (`min_wholesale_qty`); below it, the retail price applies.
- Display stock as packs + loose units, e.g. `34 bags + 12 sachets`.

Example: Sachet water: base unit = sachet; pack "Bag" = 30 sachets. Selling 2 bags removes 60 sachets from stock.

**Cost price** is stored per base unit in `product_costs` (owner-only).

## 4. Database (Supabase Postgres)

All tables: `id uuid primary key default gen_random_uuid()`, `created_at timestamptz default now()`. Money `numeric(12,2)`. Quantities `integer`. RLS enabled on all.

### 4.1 People and settings
- `shop_settings`: single row: shop_name, phone, location, momo_number, momo_name, receipt_footer, currency ('GH₵'), low_stock_default.
- `profiles`: id (= auth.users.id), full_name, phone, role (`owner` | `attendant` | null), is_active, approved_at, approved_by.
- `audit_logs`: user_id, action, entity, entity_id, details jsonb. Insert-only via triggers/RPCs. Owner read-only. No update/delete for anyone.

### 4.2 Catalogue
- `categories`: name, sort_order. Starting set: Water · Soft Drinks & Juices · Alcoholic Drinks · Canned Foods · Provisions · Toiletries & Soaps · Detergents · Polythene & Packaging · Snacks & Biscuits · Household.
- `products`: name, category_id, brand, base_unit_name, barcode (unique, nullable), retail_price, wholesale_price, min_wholesale_qty (default 1), stock_units (int, **check >= 0**), reorder_level (base units), is_quick_sell (bool), photo_url, track_expiry (bool, phase 2), is_active.
- `product_packs`: product_id, name, units_per_pack (int > 1), barcode (unique, nullable), retail_price, wholesale_price, min_wholesale_qty, is_quick_sell, is_active.
- `product_costs`: product_id (pk), cost_per_unit, updated_at, updated_by. **Owner only** (attendants have no select).

Attendants read products/packs through a view or select policy that excludes nothing sensitive (cost is in a separate table).

### 4.3 Stock ledger (core of loss tracking)
- `stock_movements`: product_id, change_units (int, + or −), balance_after (int), reason (`sale` | `delivery` | `refund` | `adjust_damaged` | `adjust_expired` | `adjust_stolen` | `count_correction` | `opening_stock` | `import`), ref_table, ref_id, unit_cost (snapshot), user_id, note.
- Every change to `products.stock_units` must happen in an RPC that also inserts here, in the same transaction.

### 4.4 Customers and credit
- `customers`: name, phone, type (`retail` | `wholesale`), credit_limit (numeric, default 0 = no credit), balance (numeric, maintained by RPCs), notes, is_active.
- `credit_payments`: customer_id, amount, method (`cash` | `momo`), momo_txn_id, received_by, note.
- Customer statement = their credit sales + credit_payments, ordered by date.

### 4.5 Sales
- `sales`: receipt_no (human-friendly, e.g. `KP-000123`, sequence), attendant_id, customer_id (nullable = walk-in), price_mode (`retail` | `wholesale`), subtotal, discount, total, cost_total (owner-only exposure), paid_cash, paid_momo, momo_txn_id, credit_amount, change_given, status (`completed` | `held_for_approval` | `refunded` | `void`), approval_request_id.
- `sale_items`: sale_id, product_id, pack_id (nullable), qty (in the unit sold), units (base units = qty × units_per_pack), unit_price, line_total, unit_cost_snapshot.
- Attendants can select **only their own** sales; owner sees all. Nobody can update or delete sale rows directly.

### 4.6 Goods received
- `suppliers`: name, phone, notes, balance_owed (phase 2).
- `deliveries`: supplier_id, received_by, invoice_photo_url, status (`pending_check` | `confirmed` | `queried`), checked_by, checked_at, note.
- `delivery_items`: delivery_id, product_id, pack_id, qty, units, unit_cost (set/confirmed by owner; attendants cannot set cost).
- Stock goes up **immediately** when an attendant saves a delivery (so selling continues), but the delivery stays `pending_check` until the owner confirms or queries.

### 4.7 Cash-up (end of day per attendant)
- `cash_ups`: attendant_id, business_date, expected_cash, expected_momo, credit_given, handover_method (`momo` | `safe`), amount_handed, momo_txn_id, status (`submitted` | `confirmed` | `short`), confirmed_by, confirmed_amount, shortage (= expected_cash − confirmed_amount), note.
- Expected figures are **computed by the RPC** from that attendant's completed sales and credit repayments for the day, not typed by the attendant.

### 4.8 Stock counts
- `stock_counts`: type (`spot` | `full`), started_by, status (`open` | `completed`), completed_at, note.
- `stock_count_items`: count_id, product_id, expected_units (snapshot at count time), counted_units, difference_units, difference_cost.
- On completion the owner chooses to **apply corrections** (writes `count_correction` movements) or just record.

### 4.9 Expenses
- `expenses`: category (rent, electricity, transport, salary, other), amount, paid_by, note, receipt_photo_url. Owner can add; attendants can add with status pending (owner confirms).

### 4.10 Approvals
- `approval_requests`: type (`discount` | `credit_over_limit` | `refund` | `price_change` | `void_sale` | `stock_adjustment`), requested_by, payload jsonb, status (`pending` | `approved` | `rejected`), decided_by, decided_at, reason.
- A sale needing approval is saved as `held_for_approval` (stock **not** deducted yet). When approved, the RPC completes it; when rejected, it becomes `void`.

### 4.11 RPC functions (security definer, check role inside, one transaction each)
| Function | Who | Does |
|---|---|---|
| `complete_sale(items, price_mode, customer_id, payment)` | attendant/owner | Looks up prices server-side, applies wholesale min-qty rule, checks stock (no negative), checks credit limit (over limit → hold + approval), inserts sale + items + movements, updates stock and customer balance, audit log. Returns receipt. |
| `request_approval(type, payload)` | attendant | Creates approval request. |
| `decide_approval(id, approve, reason)` | owner | Approves/rejects and executes the held action. |
| `refund_sale(sale_id, items, reason)` | owner | Returns stock (`refund` movements), adjusts balances. |
| `record_delivery(supplier_id, items, photo_url)` | attendant/owner | Adds stock + movements, status pending_check (confirmed directly if owner). |
| `confirm_delivery(id, costs, status)` | owner | Sets unit costs, updates `product_costs`, marks confirmed/queried. |
| `record_credit_payment(customer_id, amount, method, txn)` | attendant/owner | Reduces balance, logs. |
| `submit_cash_up(business_date, method, amount, txn)` | attendant | Computes expected figures, saves. One per attendant per day. |
| `confirm_cash_up(id, confirmed_amount, note)` | owner | Records shortage if any. |
| `start_stock_count(type, product_ids)` / `submit_count_item(...)` / `complete_stock_count(id, apply)` | owner (attendant may count if owner starts it) | Snapshot expected, record counted, compute difference at cost. |
| `adjust_stock(product_id, change, reason, note)` | owner | Damaged/expired/stolen adjustments. Attendants must request. |
| `import_products(rows jsonb)` | owner | Bulk create/update from Excel; opening stock as `import`/`opening_stock` movements. |
| `owner_dashboard(from, to)` | owner | Returns sales, profit, cash/momo/credit split, per-attendant totals, money owed, low stock count, pending approvals, missing stock value. |

Include a DB test checklist proving: attendant cannot select `product_costs`; attendant cannot update `products.stock_units` or prices; stock can't go negative; sale totals ignore client-sent prices.

### 4.12 Storage buckets
- `product-photos` (public read, owner write). Compress to ≤ ~100 KB, max 800px, before upload.
- `invoices` (private; uploader + owner read). For delivery invoice and expense receipt photos.

## 5. Screens

Phone-first (390px wide). Same app adapts to tablet (two columns). Installable as a PWA ("Add to Home Screen") with the Koprice logo icon.

### Attendant (bottom nav: Sell · Receive goods · My day)
1. **Sell**: header with logo + attendant name; search box + camera **Scan** button; **Retail / Wholesale** switch; **Quick sell** buttons (items with `is_quick_sell`); current sale list with − / + qty; big orange **Take payment · GH₵ total** button.
   - Tablet: product tiles grid with category chips on the left; sale panel on the right with customer picker, total and Take payment.
2. **Payment**: total; method buttons **Cash · MoMo · Credit (pay later) · Split**; cash received → change; MoMo → transaction ID; credit → choose/add customer, shows balance and limit; optional customer WhatsApp number for receipt; **Complete sale**.
3. **Receipt**: success state, receipt number, **Send on WhatsApp** (wa.me link with text receipt), New sale.
4. **Receive goods**: supplier picker, **Take photo of invoice**, add items by scan/search with qty (packs or units), note "Prince confirms on next visit", **Save delivery**.
5. **My day**: my sales total and count; MoMo, credit given; **Cash to hand over**; handover method (Sent by MoMo / Put in shop safe); amount + MoMo txn ID; **Close my day**.
6. **Request** sheets: discount, credit over limit, refund: reason field, sends to owner.

### Owner (bottom nav: Home · Stock · Money · Approvals · Reports)
1. **Home**: today's sales (big), cash/MoMo/credit split, profit; alert cards: approvals waiting, missing stock value, low-stock count; sales by attendant; money owed.
2. **Approvals**: cards per request with details and Approve/Reject; deliveries with invoice photo and Confirm/Query; cash-ups with Confirm/Short.
3. **Stock**: product list with search, category filter, stock (packs + loose), low-stock badge; product detail (prices, packs, cost, movements history); add/edit product; **Import from Excel**; **Start spot count / full count**; adjustments.
4. **Missing stock**: expected vs counted (at cost), missing GH₵, list of items short with expected/counted/difference/value, attendants on duty in that period; Share report.
5. **Money**: Money owed (debtors list with days owed, limit, WhatsApp reminder, record repayment, customer statement); cash-ups history with shortages per attendant; expenses.
6. **Reports**: Today / This week / This month; sales, profit, stock value at cost, expenses, with comparison to previous period; daily sales chart split retail/wholesale; best sellers; slow movers / dead stock; sales per attendant; credit sales vs paid; **Download Excel**.
7. **Settings**: shop details (name, phone, MoMo number for receipts), staff (approve, assign role, deactivate), categories, suppliers, customers.

## 6. Loss-prevention logic (must work exactly)

- **Stock check (at cost price):** Opening stock + Deliveries − Sales + Refunds ± Adjustments = **Expected**. Compare with **Counted** in a stock count → difference per item and in GH₵ at cost. Always compare at **cost**, never selling price.
- **Cash check:** for each attendant and day: Sales total = Cash + MoMo + Credit. Expected cash vs confirmed handover → shortage, stored and shown over time.
- **Signals on Owner Home/Reports:** any discount, refund, void, adjustment, credit over limit, sudden drop in an attendant's sales vs their average.
- **Audit log** for every sensitive action; visible to owner, not editable.

## 7. Excel import (stock loading)

Provide a downloadable template (`/templates/koprice-products.xlsx`) with columns:
`name, category, brand, base_unit, barcode, cost_per_unit, retail_price, wholesale_price, min_wholesale_qty, opening_stock_units, reorder_level, quick_sell (yes/no), pack_name, units_per_pack, pack_barcode, pack_retail_price, pack_wholesale_price`
(One row per product; a second sheet "packs" for products with more than one pack.)
Import screen: upload → preview table with errors highlighted (missing price, duplicate barcode, unknown category) → confirm → `import_products` RPC. Use SheetJS (`xlsx`).

## 8. Design

Simple, professional, phone-first. Match the approved design preview.

- **Font:** Outfit (Google Fonts), weights 400–800.
- **Colors:**
  - Brand green `#166534` (primary buttons, active nav, headings) · dark green `#14532d`
  - Accent orange `#f59e0b` (main action "Take payment", "Close my day"; logo circle)
  - Text `#12261a` · muted text `#4a6352`
  - Background `#f4f6f2` · cards `#ffffff` · borders `#e3e8e1` / inputs `#d3dbd1`
  - Danger `#b91c1c` · warning text `#9a5b00` on `#fdf1dc` · info `#1e4f8a` on `#e3edf8` · success tint `#e8f3ec`
- **Shape:** card radius 16–18px, buttons/inputs 12–16px. Touch targets ≥ 44px; main actions 56–60px tall.
- **Numbers:** prices and totals large and bold, always `GH₵ 0.00`.
- **Logo:** orange circle (`#f59e0b`) with thin dark inner ring and bold "KP" (`#12261a`), next to "Koprice" wordmark in green with "ENTERPRISE" in small spaced capitals below. Build as an inline SVG component; also export PWA icons (192, 512, maskable).
- **Icons:** simple stroke SVG icons (e.g. lucide-react). No emoji.
- Labels in plain English: "Sell", "Receive goods", "My day", "Money owed", "Missing stock", "Take payment".
- Accessible: real buttons/inputs/labels, `aria-label` on icon-only buttons, contrast ≥ 4.5:1.

## 9. Other technical requirements

- **Auth:** Supabase email + password. Session via `@supabase/ssr` middleware. Role guard on every route (attendant routes vs owner routes).
- **Barcode scanning:** phone camera, using the `BarcodeDetector` API where available with `@zxing/browser` fallback. Also accept USB/Bluetooth scanner input in the search box.
- **Receipts:** WhatsApp share link (`https://wa.me/<number>?text=...`) with shop name, items, total, payment, receipt no. Optional printing is phase 2.
- **Owner alerts (phase 1):** in-app badges + an **end-of-day summary** screen with a "Share to WhatsApp" button. Automatic push/WhatsApp messages are phase 2 (WhatsApp API costs money).
- **Backups:** GitHub Action (nightly) that runs `pg_dump` / `supabase db dump` using a `SUPABASE_DB_URL` GitHub secret and commits the dump to a separate **private** backup repo. Owner can also export data to Excel any time.
- **Keep-alive:** a tiny scheduled job (GitHub Action, daily) that queries the DB so the free project never pauses during shop holidays.
- **Free plan limits:** DB 500 MB, storage 1 GB. Compress images; photos optional.
- **Environment variables** (`.env.local`, never committed): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or publishable key). No service-role key in the browser, ever.
- **Timezone:** Africa/Accra (UTC+0). Business day = calendar day in Accra.
- **Testing:** Vitest unit tests for price selection (retail/wholesale/min qty), unit/pack conversions, cash-up math, missing-stock math.

## 10. Build phases (do in order, one at a time)

Each phase ends with lint + typecheck + build passing, a git commit, and a short summary + manual test checklist for Annor.

0. **Project setup**: Next.js 16 + TS + Tailwind + Supabase clients + middleware; design tokens; Outfit font; logo component; PWA manifest/icons; app shells (attendant bottom nav, owner bottom nav, tablet layout).
1. **Database**: migrations for all tables in §4, constraints, indexes, RLS policies, storage buckets, audit triggers. Write as files; tell Annor exactly how to apply them (SQL Editor or `supabase db push`) and wait.
2. **Auth & staff**: login, signup, pending-access screen, forgot password, owner Staff page (approve, assign role, deactivate). First owner account: give Annor the one-time SQL to set his/Prince's profile to `owner`.
3. **Products**: categories, products, packs, costs, photos (compressed), product list/detail, low-stock badge, **Excel template + import**.
4. **Selling**: Sell screen (phone + tablet), scanner, quick sell, Retail/Wholesale, Payment (cash/MoMo/credit/split), `complete_sale`, receipt + WhatsApp share.
5. **Customers & credit**: customers, credit limits, Money Owed, repayments, statements, WhatsApp reminder.
6. **Receive goods**: deliveries with invoice photo; owner confirm/query with costs; suppliers.
7. **Approvals**: requests (discount, credit over limit, refund, void, adjustment) and owner decisions; held sales flow.
8. **My Day & cash-up**: attendant close day; owner confirm; shortages history.
9. **Stock counts & Missing stock**: spot/full counts, report, apply corrections, adjustments.
10. **Owner Home & Reports**: dashboard RPC, reports, charts, Excel export, end-of-day summary share.
11. **Expenses, settings, audit log viewer.**
12. **Backups & keep-alive** GitHub Actions; README with setup and deploy steps (Netlify).

### Phase 2 (later, quote separately)
Expiry dates by batch + "expiring soon"; purchase orders + supplier balances; offline mode (queue sales when internet drops); barcode label printing; Bluetooth receipt printer; push notifications / automatic WhatsApp alerts; empty bottle/crate deposits.

## 11. Open questions (confirm with Prince; build with sensible defaults meanwhile)
- Daily cash: sent by MoMo to Prince, or kept in a shop safe? (Support both.)
- Credit limit per customer and who may give credit? (Default: limit per customer; attendants within limit, over limit needs approval.)
- Does wholesale price depend on quantity? (Support `min_wholesale_qty`.)
- Empty bottle/crate deposits? (Phase 2 unless needed.)
- Shop phone number and MoMo number for receipts? (Settings fields.)
- Which items have no barcode? (Mark as quick sell; allow printing labels in phase 2.)
