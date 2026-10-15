import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Approvals" };

const REQUEST_LABELS: Record<string, string> = {
  discount: "Discount",
  credit_over_limit: "Credit over limit",
  refund: "Refund",
  price_change: "Price change",
  void_sale: "Cancel a sale",
  stock_adjustment: "Stock problem",
};

export default async function ApprovalsPage() {
  const supabase = await createClient();
  const [requests, deliveries, cashUps, expenses] = await Promise.all([
    supabase
      .from("approval_requests")
      .select("id, created_at, type, payload, profiles!approval_requests_requested_by_fkey(full_name)")
      .eq("status", "pending")
      .order("created_at"),
    supabase
      .from("deliveries")
      .select("id, created_at, status, suppliers(name), profiles!deliveries_received_by_fkey(full_name), delivery_items(count)")
      .in("status", ["pending_check", "queried"])
      .order("created_at"),
    supabase
      .from("cash_ups")
      .select("id, business_date, expected_cash, amount_handed, handover_method, profiles!cash_ups_attendant_id_fkey(full_name)")
      .eq("status", "submitted")
      .order("business_date"),
    supabase
      .from("expenses")
      .select("id, expense_date, category, amount, note, profiles!expenses_paid_by_fkey(full_name)")
      .eq("status", "pending")
      .order("created_at"),
  ]);

  const nothing =
    !requests.data?.length && !deliveries.data?.length && !cashUps.data?.length && !expenses.data?.length;

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-bold text-brand">Approvals</h1>
      {nothing && (
        <p className="rounded-card border border-dashed border-input bg-card p-6 text-center text-muted">
          Nothing is waiting for you.
        </p>
      )}

      <Group title="Requests from staff" count={requests.data?.length ?? 0}>
        {requests.data?.map((r) => {
          const p = (r.payload ?? {}) as { reason?: string; total?: number; discount?: number; credit?: number; customer_name?: string };
          return (
            <Row key={r.id} href={`/owner/approvals/requests/${r.id}`}>
              <span className="block font-semibold">{REQUEST_LABELS[r.type] ?? r.type}</span>
              <span className="block text-sm text-muted">
                {r.profiles?.full_name ?? "?"} · {formatDateTime(r.created_at)}
                {p.total != null && ` · ${formatMoney(p.total)}`}
                {p.customer_name && ` · ${p.customer_name}`}
              </span>
              {p.reason && <span className="block text-sm">&ldquo;{p.reason}&rdquo;</span>}
            </Row>
          );
        })}
      </Group>

      <Group title="Deliveries to check" count={deliveries.data?.length ?? 0}>
        {deliveries.data?.map((d) => (
          <Row key={d.id} href={`/owner/approvals/deliveries/${d.id}`}>
            <span className="block font-semibold">
              {d.suppliers?.name ?? "No supplier"}
              {d.status === "queried" && <span className="ml-2 text-sm text-danger">Queried</span>}
            </span>
            <span className="block text-sm text-muted">
              {d.profiles?.full_name ?? "?"} · {formatDateTime(d.created_at)} · {d.delivery_items[0]?.count ?? 0} items
            </span>
          </Row>
        ))}
      </Group>

      <Group title="Cash-ups to confirm" count={cashUps.data?.length ?? 0}>
        {cashUps.data?.map((c) => (
          <Row key={c.id} href={`/owner/money/cash-ups/${c.id}`}>
            <span className="block font-semibold">
              {c.profiles?.full_name ?? "?"} · {formatDate(c.business_date)}
            </span>
            <span className="block text-sm text-muted">
              Expected cash {formatMoney(c.expected_cash)} · handed {formatMoney(c.amount_handed)} ({c.handover_method === "momo" ? "MoMo" : "safe"})
            </span>
          </Row>
        ))}
      </Group>

      <Group title="Expenses to confirm" count={expenses.data?.length ?? 0}>
        {expenses.data?.map((e) => (
          <Row key={e.id} href="/owner/money/expenses">
            <span className="block font-semibold capitalize">
              {e.category} · {formatMoney(e.amount)}
            </span>
            <span className="block text-sm text-muted">
              {e.profiles?.full_name ?? "?"} · {formatDate(e.expense_date)}
              {e.note && ` · ${e.note}`}
            </span>
          </Row>
        ))}
      </Group>
    </section>
  );
}

function Group({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  if (count === 0) return null;
  return (
    <div className="space-y-2">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        {title}
        <span className="rounded-full bg-accent px-2.5 py-0.5 text-sm text-ink">{count}</span>
      </h2>
      <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-card">{children}</ul>
    </div>
  );
}

function Row({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-bg">
        <span className="min-w-0 flex-1">{children}</span>
        <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-muted" />
      </Link>
    </li>
  );
}
