import type { Metadata } from "next";
import Link from "next/link";
import { BackLink } from "@/components/BackLink";
import { formatDateTime } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Audit log" };

const PAGE_SIZE = 50;

const ACTIONS: Record<string, string> = {
  insert: "Added",
  update: "Changed",
  delete: "Removed",
  import: "Excel import",
  sale_held: "Sale held for approval",
  sale_with_override: "Sale with discount / over credit limit",
  sale_refunded: "Sale refunded",
  sale_void: "Sale cancelled",
  credit_payment: "Credit repayment",
  stock_adjustment: "Stock written off / corrected",
  delivery_confirmed: "Delivery confirmed",
  delivery_queried: "Delivery queried",
  approval_approved: "Request approved",
  approval_rejected: "Request rejected",
  cash_up_confirmed: "Cash-up confirmed",
  cash_up_short: "Cash-up short",
  stock_count_started: "Stock count started",
  stock_count_completed: "Stock count finished",
};

const ENTITIES: Record<string, string> = {
  products: "Product",
  product_packs: "Pack",
  product_costs: "Cost price",
  categories: "Category",
  customers: "Customer",
  suppliers: "Supplier",
  expenses: "Expense",
  profiles: "Staff",
  shop_settings: "Shop details",
  sales: "Sale",
  deliveries: "Delivery",
  approval_requests: "Request",
  cash_ups: "Cash-up",
  stock_counts: "Stock count",
};

const FILTERS = [
  { key: "all", label: "Everything" },
  { key: "money", label: "Sales & money", entities: ["sales", "cash_ups", "customers", "expenses"] },
  { key: "stock", label: "Stock & prices", entities: ["products", "product_packs", "product_costs", "deliveries", "stock_counts"] },
  { key: "staff", label: "Staff & approvals", entities: ["profiles", "approval_requests", "shop_settings"] },
];

/** A short, readable summary of what changed. */
function summarise(action: string, details: Record<string, unknown>) {
  if (action === "update") {
    return Object.entries(details)
      .slice(0, 4)
      .map(([field, change]) => {
        const c = change as { old: unknown; new: unknown };
        return `${field.replace(/_/g, " ")}: ${String(c?.old ?? "—")} → ${String(c?.new ?? "—")}`;
      })
      .join("; ");
  }
  const pick = ["name", "receipt_no", "reason", "note", "amount", "total", "change_units", "shortage", "type", "role"];
  return pick
    .filter((k) => details[k] !== undefined && details[k] !== null && details[k] !== "")
    .map((k) => `${k.replace(/_/g, " ")}: ${String(details[k])}`)
    .join("; ");
}

export default async function AuditPage({ searchParams }: PageProps<"/owner/settings/audit">) {
  const params = await searchParams;
  const page = Math.max(0, Number(params.page) || 0);
  const filter = FILTERS.find((f) => f.key === params.filter) ?? FILTERS[0];
  const supabase = await createClient();

  let query = supabase
    .from("audit_logs")
    .select("id, created_at, user_id, action, entity, entity_id, details")
    .order("created_at", { ascending: false })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  if (filter.entities) query = query.in("entity", filter.entities);
  const [{ data }, { data: people }] = await Promise.all([query, supabase.from("profiles").select("id, full_name")]);
  const names = new Map((people ?? []).map((p) => [p.id, p.full_name]));
  const rows = (data ?? []).slice(0, PAGE_SIZE);
  const hasMore = (data ?? []).length > PAGE_SIZE;

  return (
    <section className="space-y-4">
      <BackLink href="/owner/settings">Settings</BackLink>
      <div>
        <h1 className="text-2xl font-bold text-brand">Audit log</h1>
        <p className="text-muted">Every sensitive change, who made it and when. Nobody can edit or delete these records.</p>
      </div>

      <nav aria-label="Filter" className="-mx-4 flex gap-2 overflow-x-auto px-4">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`?filter=${f.key}`}
            aria-current={f.key === filter.key ? "page" : undefined}
            className={`flex h-10 shrink-0 items-center rounded-full px-4 text-sm font-semibold ${f.key === filter.key ? "bg-brand text-white" : "border border-input bg-card"}`}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <p className="rounded-card border border-dashed border-input bg-card p-6 text-center text-muted">Nothing here.</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-card text-sm">
          {rows.map((r) => {
            const details = (r.details ?? {}) as Record<string, unknown>;
            return (
              <li key={r.id} className="space-y-0.5 px-4 py-3">
                <p className="font-semibold">
                  {ACTIONS[r.action] ?? r.action} · {ENTITIES[r.entity] ?? r.entity}
                </p>
                <p className="text-muted">
                  {formatDateTime(r.created_at)} · {r.user_id ? (names.get(r.user_id) ?? "Unknown user") : "System / dashboard"}
                </p>
                {summarise(r.action, details) && <p className="break-words">{summarise(r.action, details)}</p>}
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex justify-between">
        {page > 0 ? (
          <Link href={`?filter=${filter.key}&page=${page - 1}`} className="flex h-11 items-center rounded-control border border-input bg-card px-4 font-semibold">
            Newer
          </Link>
        ) : (
          <span />
        )}
        {hasMore && (
          <Link href={`?filter=${filter.key}&page=${page + 1}`} className="flex h-11 items-center rounded-control border border-input bg-card px-4 font-semibold">
            Older
          </Link>
        )}
      </div>
    </section>
  );
}
