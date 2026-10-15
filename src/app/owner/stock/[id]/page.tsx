import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ImageOff, Pencil } from "lucide-react";
import { BackLink } from "@/components/BackLink";
import { getCosts, getProduct, getShopSettings } from "@/lib/catalogue";
import { formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { formatStock, isLowStock } from "@/lib/stock";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Product" };

const REASON_LABELS: Record<string, string> = {
  sale: "Sold",
  delivery: "Delivery",
  refund: "Refund / void",
  adjust_damaged: "Damaged",
  adjust_expired: "Expired",
  adjust_stolen: "Stolen / missing",
  count_correction: "Count correction",
  opening_stock: "Opening stock",
  import: "Excel import",
};

export default async function ProductPage({ params }: PageProps<"/owner/stock/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const [product, costs, settings, movements] = await Promise.all([
    getProduct(id),
    getCosts(),
    getShopSettings(),
    supabase
      .from("stock_movements")
      .select("id, created_at, change_units, balance_after, reason, note, profiles(full_name)")
      .eq("product_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  if (!product) notFound();

  const cost = costs.get(id);
  const low = isLowStock(product.stock_units, product.reorder_level, settings.low_stock_default);
  const options = [
    { name: `1 ${product.base_unit_name}`, units: 1, retail: product.retail_price, wholesale: product.wholesale_price, minQty: product.min_wholesale_qty, active: true },
    ...product.packs.map((p) => ({
      name: `1 ${p.name} (${p.units_per_pack})`,
      units: p.units_per_pack,
      retail: p.retail_price,
      wholesale: p.wholesale_price,
      minQty: p.min_wholesale_qty,
      active: p.is_active,
    })),
  ];

  return (
    <section className="space-y-4">
      <BackLink href="/owner/stock">Stock</BackLink>

      <div className="flex items-start gap-4">
        {product.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.photo_url} alt="" className="size-20 shrink-0 rounded-card object-cover" />
        ) : (
          <span className="flex size-20 shrink-0 items-center justify-center rounded-card bg-card text-muted">
            <ImageOff aria-hidden="true" className="size-7" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-brand">{product.name}</h1>
          <p className="text-muted">
            {[product.brand, product.barcode && `Barcode ${product.barcode}`].filter(Boolean).join(" · ") || "No brand or barcode"}
          </p>
          {!product.is_active && <p className="font-semibold text-warning">Hidden – not for sale</p>}
        </div>
        <Link
          href={`/owner/stock/${id}/edit`}
          className="flex h-12 shrink-0 items-center gap-2 rounded-control border border-input bg-card px-4 font-semibold"
        >
          <Pencil aria-hidden="true" className="size-4" /> Edit
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="In stock" value={formatStock(product.stock_units, product.base_unit_name, product.packs)} danger={low} note={low ? "Low stock" : `${product.stock_units} ${product.base_unit_name}s`} />
        <Stat label={`Cost per ${product.base_unit_name}`} value={cost != null ? formatMoney(cost) : "Not set"} note={cost != null ? `GH₵ ${cost.toFixed(4)}` : "Add it in Edit"} />
        <Stat label="Stock value at cost" value={cost != null ? formatMoney(cost * product.stock_units) : "—"} />
      </div>

      <div className="overflow-x-auto rounded-card border border-line bg-card">
        <table className="w-full text-left text-sm">
          <thead className="bg-bg text-muted">
            <tr>
              <th className="px-3 py-2 font-semibold">Sold as</th>
              <th className="px-3 py-2 text-right font-semibold">Retail</th>
              <th className="px-3 py-2 text-right font-semibold">Wholesale</th>
              <th className="px-3 py-2 text-right font-semibold">Profit (retail)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {options.map((o) => (
              <tr key={o.name} className={o.active ? "" : "opacity-50"}>
                <td className="px-3 py-2 font-semibold">{o.name}</td>
                <td className="px-3 py-2 text-right">{formatMoney(o.retail)}</td>
                <td className="px-3 py-2 text-right">
                  {formatMoney(o.wholesale)}
                  {o.minQty > 1 && <span className="block text-xs text-muted">from {o.minQty}</span>}
                </td>
                <td className="px-3 py-2 text-right">{cost != null ? formatMoney(o.retail - cost * o.units) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-bold">Stock history</h2>
        {movements.data && movements.data.length > 0 ? (
          <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-card text-sm">
            {movements.data.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <span className="min-w-0">
                  <span className="block font-semibold">{REASON_LABELS[m.reason] ?? m.reason}</span>
                  <span className="block truncate text-muted">
                    {formatDateTime(m.created_at)}
                    {m.profiles?.full_name ? ` · ${m.profiles.full_name}` : ""}
                    {m.note ? ` · ${m.note}` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className={`block font-bold ${m.change_units < 0 ? "text-danger" : "text-brand"}`}>
                    {m.change_units > 0 ? "+" : ""}
                    {m.change_units}
                  </span>
                  <span className="block text-xs text-muted">left {m.balance_after}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-card border border-dashed border-input bg-card p-4 text-muted">No stock changes yet.</p>
        )}
      </div>
    </section>
  );
}

function Stat({ label, value, note, danger }: { label: string; value: string; note?: string; danger?: boolean }) {
  return (
    <div className="rounded-card border border-line bg-card p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className={`text-xl font-extrabold ${danger ? "text-danger" : "text-ink"}`}>{value}</p>
      {note && <p className={`text-sm ${danger ? "font-semibold text-danger" : "text-muted"}`}>{note}</p>}
    </div>
  );
}
