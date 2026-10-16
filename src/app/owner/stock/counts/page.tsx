import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { BackLink } from "@/components/BackLink";
import { formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Stock counts" };

export default async function CountsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("stock_counts")
    .select("id, type, status, created_at, completed_at, corrections_applied, note, stock_count_items(counted_units, difference_cost)")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <section className="space-y-4">
      <BackLink href="/owner/stock">Stock</BackLink>
      <div className="flex items-end justify-between gap-3">
        <h1 className="text-2xl font-bold text-brand">Stock counts</h1>
        <Link href="/owner/stock/counts/new" className="flex h-12 items-center gap-2 rounded-control bg-brand px-4 font-semibold text-white">
          <Plus aria-hidden="true" className="size-5" /> Start a count
        </Link>
      </div>
      <p className="text-muted">
        A spot count checks a few products (do one each visit). A full count checks everything. Attendants can help count;
        they don&apos;t see what the system expects.
      </p>
      {!data?.length ? (
        <p className="rounded-card border border-dashed border-input bg-card p-6 text-center text-muted">No counts yet.</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-card">
          {data.map((c) => {
            const items = c.stock_count_items ?? [];
            const counted = items.filter((i) => i.counted_units !== null).length;
            const missing = -items.reduce((sum, i) => sum + Math.min(0, Number(i.difference_cost ?? 0)), 0);
            return (
              <li key={c.id}>
                <Link href={`/owner/stock/counts/${c.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-bg">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">
                      {c.type === "full" ? "Full count" : "Spot count"} · {counted}/{items.length} counted
                    </span>
                    <span className="block text-sm text-muted">
                      {formatDateTime(c.created_at)}
                      {c.note && ` · ${c.note}`}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-sm">
                    {c.status === "open" ? (
                      <span className="rounded-full bg-warning-bg px-2.5 py-1 font-bold text-warning">Open</span>
                    ) : (
                      <span className={`font-bold ${missing > 0 ? "text-danger" : "text-brand"}`}>{missing > 0 ? `${formatMoney(missing)} missing` : "Nothing missing"}</span>
                    )}
                  </span>
                  <ChevronRight aria-hidden="true" className="size-5 text-muted" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
