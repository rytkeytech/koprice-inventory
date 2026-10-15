"use client";

import Link from "next/link";
import { ImageOff, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { Category, Product } from "@/lib/catalogue";
import { formatMoney } from "@/lib/money";
import { formatStock, isLowStock } from "@/lib/stock";

type Props = {
  products: Product[];
  categories: Category[];
  lowStockDefault: number;
};

export function StockList({ products, categories, lowStockDefault }: Props) {
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<string>("all");
  const [lowOnly, setLowOnly] = useState(false);
  const [showHidden, setShowHidden] = useState(false);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (!showHidden && !p.is_active) return false;
      if (categoryId !== "all" && p.category_id !== categoryId) return false;
      if (lowOnly && !isLowStock(p.stock_units, p.reorder_level, lowStockDefault)) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.brand ?? "").toLowerCase().includes(q) ||
        p.barcode === q ||
        p.packs.some((pk) => pk.barcode === q)
      );
    });
  }, [products, query, categoryId, lowOnly, showHidden, lowStockDefault]);

  const lowCount = products.filter(
    (p) => p.is_active && isLowStock(p.stock_units, p.reorder_level, lowStockDefault),
  ).length;

  return (
    <div className="space-y-3">
      <label className="relative block">
        <span className="sr-only">Search products</span>
        <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, brand or barcode"
          className="h-12 w-full rounded-control border border-input bg-card pr-3 pl-10 text-base"
        />
      </label>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Filter by category">
        <Chip active={categoryId === "all"} onClick={() => setCategoryId("all")}>
          All
        </Chip>
        {categories
          .filter((c) => c.is_active)
          .map((c) => (
            <Chip key={c.id} active={categoryId === c.id} onClick={() => setCategoryId(c.id)}>
              {c.name}
            </Chip>
          ))}
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex min-h-11 items-center gap-2 font-semibold">
          <input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} className="size-5 accent-brand" />
          Low stock only ({lowCount})
        </label>
        <label className="flex min-h-11 items-center gap-2 text-muted">
          <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} className="size-5 accent-brand" />
          Show hidden products
        </label>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-card border border-dashed border-input bg-card p-6 text-center text-muted">
          {products.length === 0 ? "No products yet. Add one or import from Excel." : "No products match."}
        </p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-card">
          {visible.map((p) => {
            const low = isLowStock(p.stock_units, p.reorder_level, lowStockDefault);
            return (
              <li key={p.id}>
                <Link href={`/owner/stock/${p.id}`} className="flex items-center gap-3 px-3 py-3 hover:bg-bg">
                  {p.photo_url ? (
                    // Product photos are small, pre-compressed files from Supabase Storage.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.photo_url} alt="" className="size-12 shrink-0 rounded-control object-cover" loading="lazy" />
                  ) : (
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-control bg-bg text-muted">
                      <ImageOff aria-hidden="true" className="size-5" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-ink">
                      {p.name}
                      {!p.is_active && <span className="ml-2 text-sm font-normal text-muted">(hidden)</span>}
                    </span>
                    <span className={`block text-sm ${low ? "font-semibold text-danger" : "text-muted"}`}>
                      {formatStock(p.stock_units, p.base_unit_name, p.packs)}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-bold text-ink">{formatMoney(p.retail_price)}</span>
                    {low && (
                      <span className="mt-0.5 inline-block rounded-full bg-danger/10 px-2 py-0.5 text-xs font-bold text-danger">
                        Low stock
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`h-10 shrink-0 rounded-full px-4 text-sm font-semibold whitespace-nowrap ${
        active ? "bg-brand text-white" : "border border-input bg-card text-ink"
      }`}
    >
      {children}
    </button>
  );
}
