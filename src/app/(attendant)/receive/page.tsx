import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { getProducts } from "@/lib/catalogue";
import { formatDateTime } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { ReceiveForm } from "./ReceiveForm";

export const metadata: Metadata = { title: "Receive goods" };

const STATUS: Record<string, { label: string; className: string }> = {
  pending_check: { label: "Waiting for owner", className: "bg-warning-bg text-warning" },
  confirmed: { label: "Confirmed", className: "bg-success-bg text-brand" },
  queried: { label: "Owner has a question", className: "bg-danger/10 text-danger" },
};

export default async function ReceivePage() {
  const supabase = await createClient();
  const user = await getCurrentUser();
  const [products, suppliers, recent] = await Promise.all([
    getProducts({ activeOnly: true }),
    supabase.from("suppliers").select("id, name").eq("is_active", true).order("name"),
    supabase
      .from("deliveries")
      .select("id, created_at, status, note, suppliers(name), delivery_items(count)")
      .eq("received_by", user?.id ?? "")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  return (
    <section className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold text-brand">Receive goods</h1>
      <ReceiveForm products={products} suppliers={suppliers.data ?? []} userId={user?.id ?? ""} isOwner={user?.role === "owner"} />

      {recent.data && recent.data.length > 0 && (
        <div className="space-y-2 pt-4">
          <h2 className="text-lg font-bold">My recent deliveries</h2>
          <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-card">
            {recent.data.map((d) => {
              const status = STATUS[d.status] ?? STATUS.pending_check;
              return (
                <li key={d.id} className="flex items-start justify-between gap-3 px-4 py-3">
                  <span className="min-w-0">
                    <span className="block font-semibold">{d.suppliers?.name ?? "No supplier"}</span>
                    <span className="block text-sm text-muted">
                      {formatDateTime(d.created_at)} · {d.delivery_items[0]?.count ?? 0} items
                    </span>
                    {d.status === "queried" && d.note && <span className="block text-sm text-danger">{d.note}</span>}
                  </span>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${status.className}`}>{status.label}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
