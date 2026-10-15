import type { Metadata } from "next";
import { BackLink } from "@/components/BackLink";
import { StockProblemForm } from "@/components/StockProblemForm";
import { getProducts } from "@/lib/catalogue";
import { formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Damaged / expired" };

const LABELS: Record<string, string> = {
  adjust_damaged: "Damaged",
  adjust_expired: "Expired",
  adjust_stolen: "Missing / stolen",
  count_correction: "Count correction",
};

export default async function AdjustPage() {
  const supabase = await createClient();
  const [products, { data: recent }] = await Promise.all([
    getProducts({ activeOnly: true }),
    supabase
      .from("stock_movements")
      .select("id, created_at, change_units, reason, note, unit_cost, products(name, base_unit_name), profiles(full_name)")
      .in("reason", ["adjust_damaged", "adjust_expired", "adjust_stolen"])
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  return (
    <section className="mx-auto max-w-xl space-y-6">
      <BackLink href="/owner/stock">Stock</BackLink>
      <h1 className="text-2xl font-bold text-brand">Damaged, expired or missing</h1>
      <div className="rounded-card border border-line bg-card p-4">
        <StockProblemForm products={products} mode="owner" />
      </div>

      {recent && recent.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-lg font-bold">Recent write-offs</h2>
          <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-card text-sm">
            {recent.map((m) => (
              <li key={m.id} className="flex justify-between gap-3 px-4 py-3">
                <span className="min-w-0">
                  <span className="block font-semibold">
                    {m.products?.name} · {LABELS[m.reason]}
                  </span>
                  <span className="block text-muted">
                    {formatDateTime(m.created_at)} · {m.profiles?.full_name ?? "?"}
                    {m.note && ` · ${m.note}`}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-bold text-danger">{m.change_units}</span>
                  {m.unit_cost != null && <span className="block text-muted">{formatMoney(Number(m.unit_cost) * m.change_units)}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
