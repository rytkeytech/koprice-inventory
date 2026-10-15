import type { Metadata } from "next";
import { ScanLine, Search } from "lucide-react";

export const metadata: Metadata = { title: "Sell" };

// Layout skeleton only. Selling is built in phase 4.
// Phone: one column. Tablet (md+): products on the left, sale panel on the right.
export default function SellPage() {
  return (
    <div className="grid gap-4 md:grid-cols-[1fr_360px]">
      <section aria-labelledby="products-heading" className="space-y-4">
        <h1 id="products-heading" className="text-2xl font-bold text-brand">
          Sell
        </h1>

        <div className="flex gap-2">
          <label className="relative flex-1">
            <span className="sr-only">Search products</span>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted"
            />
            <input
              type="search"
              disabled
              placeholder="Search or scan a product"
              className="h-12 w-full rounded-control border border-input bg-card pr-3 pl-10 text-base placeholder:text-muted disabled:opacity-70"
            />
          </label>
          <button
            type="button"
            disabled
            className="flex h-12 items-center gap-2 rounded-control bg-brand px-4 font-semibold text-white disabled:opacity-70"
          >
            <ScanLine aria-hidden="true" className="size-5" />
            Scan
          </button>
        </div>

        <div
          role="group"
          aria-label="Price type"
          className="grid grid-cols-2 rounded-control border border-input bg-card p-1"
        >
          <button
            type="button"
            aria-pressed="true"
            disabled
            className="h-11 rounded-[10px] bg-brand font-semibold text-white"
          >
            Retail
          </button>
          <button
            type="button"
            aria-pressed="false"
            disabled
            className="h-11 rounded-[10px] font-semibold text-muted"
          >
            Wholesale
          </button>
        </div>

        <div className="rounded-card border border-dashed border-input bg-card p-6 text-center text-muted">
          Quick sell buttons and products appear here (phase 4).
        </div>
      </section>

      <aside
        aria-labelledby="sale-heading"
        className="space-y-4 rounded-card border border-line bg-card p-4 md:sticky md:top-20 md:self-start"
      >
        <h2 id="sale-heading" className="text-lg font-bold">
          Current sale
        </h2>
        <p className="text-muted">No items yet.</p>
        <button
          type="button"
          disabled
          className="h-[58px] w-full rounded-control bg-accent text-lg font-bold text-ink disabled:opacity-70"
        >
          Take payment · GH₵ 0.00
        </button>
      </aside>
    </div>
  );
}
