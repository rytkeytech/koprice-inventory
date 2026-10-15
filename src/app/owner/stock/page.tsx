import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, FileSpreadsheet, PackageMinus, Plus, SearchX } from "lucide-react";
import { getCategories, getCosts, getProducts, getShopSettings } from "@/lib/catalogue";
import { formatMoney } from "@/lib/money";
import { StockList } from "./StockList";

export const metadata: Metadata = { title: "Stock" };

export default async function StockPage() {
  const [products, categories, costs, settings] = await Promise.all([
    getProducts(),
    getCategories(),
    getCosts(),
    getShopSettings(),
  ]);

  const stockValue = products
    .filter((p) => p.is_active)
    .reduce((sum, p) => sum + p.stock_units * (costs.get(p.id) ?? 0), 0);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand">Stock</h1>
          <p className="text-muted">
            {products.filter((p) => p.is_active).length} products · Stock value at cost{" "}
            <span className="font-bold text-ink">{formatMoney(stockValue)}</span>
          </p>
        </div>
        <Link
          href="/owner/stock/new"
          className="flex h-12 items-center gap-2 rounded-control bg-brand px-4 font-semibold text-white hover:bg-brand-dark"
        >
          <Plus aria-hidden="true" className="size-5" /> Add product
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <QuickLink href="/owner/stock/import" icon={<FileSpreadsheet className="size-5" aria-hidden="true" />}>
          Import from Excel
        </QuickLink>
        <QuickLink href="/owner/stock/counts" icon={<ClipboardList className="size-5" aria-hidden="true" />}>
          Stock counts
        </QuickLink>
        <QuickLink href="/owner/stock/missing" icon={<SearchX className="size-5" aria-hidden="true" />}>
          Missing stock
        </QuickLink>
        <QuickLink href="/owner/stock/adjust" icon={<PackageMinus className="size-5" aria-hidden="true" />}>
          Damaged / expired
        </QuickLink>
      </div>

      <StockList products={products} categories={categories} lowStockDefault={settings.low_stock_default} />
    </section>
  );
}

function QuickLink({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex min-h-12 items-center gap-2 rounded-control border border-line bg-card px-3 py-2 text-sm font-semibold text-ink hover:border-brand hover:text-brand"
    >
      <span className="text-brand">{icon}</span>
      {children}
    </Link>
  );
}
