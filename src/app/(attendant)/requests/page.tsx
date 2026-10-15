import type { Metadata } from "next";
import { BackLink } from "@/components/BackLink";
import { PriceChangeForm, StockProblemForm } from "@/components/StockProblemForm";
import { getCurrentUser } from "@/lib/auth";
import { getProducts } from "@/lib/catalogue";
import { formatDateTime } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Ask the owner" };

const LABELS: Record<string, string> = {
  discount: "Discount",
  credit_over_limit: "Credit over limit",
  refund: "Refund",
  void_sale: "Cancel sale",
  stock_adjustment: "Stock problem",
  price_change: "Price change",
};

export default async function RequestsPage() {
  const supabase = await createClient();
  const user = await getCurrentUser();
  const [products, { data: mine }] = await Promise.all([
    getProducts({ activeOnly: true }),
    supabase
      .from("approval_requests")
      .select("id, created_at, type, status, payload, reason")
      .eq("requested_by", user?.id ?? "")
      .order("created_at", { ascending: false })
      .limit(15),
  ]);

  return (
    <section className="mx-auto max-w-xl space-y-6">
      <BackLink href="/my-day">My day</BackLink>
      <h1 className="text-2xl font-bold text-brand">Ask the owner</h1>

      <div className="space-y-3 rounded-card border border-line bg-card p-4">
        <h2 className="text-lg font-bold">Damaged, expired or missing stock</h2>
        <StockProblemForm products={products} mode="request" />
      </div>

      <div className="space-y-3 rounded-card border border-line bg-card p-4">
        <h2 className="text-lg font-bold">A price is wrong</h2>
        <PriceChangeForm products={products} />
      </div>

      {mine && mine.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-lg font-bold">My requests</h2>
          <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-card">
            {mine.map((r) => {
              const p = (r.payload ?? {}) as { reason?: string; product_name?: string; receipt_no?: string };
              return (
                <li key={r.id} className="flex items-start justify-between gap-3 px-4 py-3">
                  <span className="min-w-0">
                    <span className="block font-semibold">
                      {LABELS[r.type] ?? r.type}
                      {p.product_name && ` · ${p.product_name}`}
                      {p.receipt_no && ` · ${p.receipt_no}`}
                    </span>
                    <span className="block text-sm text-muted">{formatDateTime(r.created_at)}</span>
                    {r.reason && <span className="block text-sm">Owner: “{r.reason}”</span>}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                      r.status === "pending" ? "bg-warning-bg text-warning" : r.status === "approved" ? "bg-success-bg text-brand" : "bg-danger/10 text-danger"
                    }`}
                  >
                    {r.status === "pending" ? "Waiting" : r.status === "approved" ? "Approved" : "Rejected"}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
