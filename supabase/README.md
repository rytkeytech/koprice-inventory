# Database (Supabase)

## Migrations

Files in `migrations/` run in name order. Each is safe to run once on a fresh
project; they only create things (no DROP / DELETE / TRUNCATE).

| File | Contents |
|---|---|
| `…000100_foundation.sql` | profiles, shop_settings, audit_logs, role helpers, shared triggers |
| `…000200_catalogue_and_stock.sql` | categories, products, packs, costs, stock ledger |
| `…000300_customers_and_sales.sql` | customers, credit payments, approval requests, sales |
| `…000400_deliveries_cashups_counts_expenses.sql` | suppliers, deliveries, cash-ups, stock counts, expenses |
| `…000500_storage_and_starting_data.sql` | storage buckets + policies, shop settings row, starting categories |
| `20261016000100_staff_admin.sql` | Phase 2: `list_staff()` and `update_staff_access()` (owner only) |
| `20261017000100_products.sql` | Phase 3: `save_product()`, `import_products()` |
| `20261018000100_selling.sql` | Phase 4: `complete_sale()`, `sale_receipt()` |
| `20261019000100_credit.sql` | Phase 5: `record_credit_payment()`, `customer_statement()`, `debtors()` |
| `20261020000100_deliveries.sql` | Phase 6: `record_delivery()`, `confirm_delivery()`, `delivery_details()` |
| `20261021000100_approvals.sql` | Phase 7: requests, decisions, refunds, voids, `adjust_stock()` |
| `20261022000100_cash_ups.sql` | Phase 8: `my_day()`, `submit_cash_up()`, `confirm_cash_up()` |
| `20261023000100_stock_counts.sql` | Phase 9: stock counts, `missing_stock_report()` |
| `20261024000100_reports.sql` | Phase 10: `owner_dashboard()`, `sales_report()` |
| `20261025000100_expenses.sql` | Phase 11: expense decision stamping |

**Apply:** run `npx supabase db push` in the VS Code terminal and answer **Y**.

## Tests

`npm test` runs the tests in `tests/db/`, which load these migrations into
an in-memory Postgres (PGlite) with a small Supabase stand-in
(`tests/db/supabase-stub.sql`) and checks the security rules as owner,
attendant, pending user and anonymous visitor. It never touches the real project.

## How the rules are enforced

- **RLS + column grants.** Every table has RLS. Table privileges for `anon` and
  `authenticated` are revoked, then only the needed columns are granted back.
  For example, no one can write `products.stock_units` or `customers.balance`
  through the API.
- **Stock only moves through the ledger.** Inserting into `stock_movements`
  (done by RPCs) locks the product, rejects negative stock, updates
  `stock_units` and fills `balance_after` and the cost snapshot. Any other
  change to `stock_units` is rejected, even from the SQL Editor.
- **Permanent records.** Triggers block deleting sales, payments, cash-ups,
  deliveries, counts, expenses and approval requests, and block editing or
  deleting stock movements, sale items and the audit log.
- **Audit log.** Triggers log changes to products, packs, costs, categories,
  customers, suppliers, expenses, profiles and shop settings (changed columns
  only, old and new values).

## Differences from BUILD_SPEC §4 (on purpose)

| Spec | Built as | Why |
|---|---|---|
| `sales.cost_total`, `sale_items.unit_cost_snapshot` | `sale_item_costs` table (owner only) | Attendants can read their own sales; cost must stay hidden (rule 4). |
| `delivery_items.unit_cost` | `delivery_item_costs` table (owner only) | Same reason. |
| Cost columns `numeric(12,2)` | `numeric(12,4)` for per-unit costs | GH₵ 5.50 ÷ 30 sachets = 0.1833; 2 decimals would distort stock value. Totals stay `numeric(12,2)`. |
| `stock_count_items` | Owner-only; adds `unit_cost`, `counted_by`, `counted_at` | Blind counting: attendants don't see expected quantities. |
| — | `credit_payments.status` (`completed`/`void`) | A mistaken repayment can be voided instead of deleted. |
| — | `sales.client_ref`, `deliveries.client_ref` | A double tap or retry on weak internet never sells or receives twice. |
| — | `sales.reversed_*`, `credit_reversed`, `money_returned` | Records who refunded/cancelled, why, and what was given back. |
| Refunds by item | Whole-sale refunds only | Simpler and safer for v1; partial refunds can be added later. |
| — | `expenses.expense_date`, `confirmed_by`, `confirmed_at` | Needed for the pending → confirmed flow. |
| — | `stock_counts.corrections_applied`, `is_active` on categories/suppliers | Record whether a count changed stock; hide old categories/suppliers without deleting. |

## Do not

- Delete users in **Authentication → Users** once they have made sales.
  Deactivate them in the app instead (the database will refuse anyway).
- Run `seed.local.sql` or any test data against the real project.
