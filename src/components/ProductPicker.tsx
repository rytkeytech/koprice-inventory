"use client";

import { Plus, ScanLine, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import type { Product } from "@/lib/catalogue";
import { optionsFor, type SellOptionView } from "@/lib/sell-options";
import { formatStock } from "@/lib/stock";

type Props = {
  products: Product[];
  onPick: (option: SellOptionView) => void;
  /** Show only the single-unit option (e.g. stock counts). */
  unitsOnly?: boolean;
  placeholder?: string;
};

/** Search by name/brand/barcode or scan, then tap the unit or pack to add. */
export function ProductPicker({ products, onPick, unitsOnly, placeholder = "Search or scan a product" }: Props) {
  const [query, setQuery] = useState("");
  const [scanning, setScanning] = useState(false);
  const [notice, setNotice] = useState<string>();

  const byBarcode = useMemo(() => {
    const map = new Map<string, SellOptionView>();
    for (const p of products) {
      const options = optionsFor(p);
      if (p.barcode) map.set(p.barcode, options[0]);
      if (!unitsOnly) for (const o of options.slice(1)) {
        const pack = p.packs.find((pk) => pk.id === o.packId);
        if (pack?.barcode) map.set(pack.barcode, o);
      }
    }
    return map;
  }, [products, unitsOnly]);

  const pickBarcode = (code: string) => {
    const option = byBarcode.get(code.trim());
    if (!option) {
      setNotice(`No product with barcode ${code}.`);
      return false;
    }
    onPick(option);
    setNotice(`Added ${option.product.name}${option.packId ? ` (${option.label})` : ""}.`);
    return true;
  };

  const q = query.trim().toLowerCase();
  const results = q
    ? products.filter((p) => p.name.toLowerCase().includes(q) || (p.brand ?? "").toLowerCase().includes(q) || p.barcode === q).slice(0, 15)
    : [];

  return (
    <div className="space-y-2">
      {scanning && (
        <BarcodeScanner
          onClose={() => setScanning(false)}
          onDetected={(code) => {
            if (pickBarcode(code)) setScanning(false);
          }}
        />
      )}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (q && pickBarcode(query)) setQuery("");
        }}
      >
        <label className="relative flex-1">
          <span className="sr-only">{placeholder}</span>
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setNotice(undefined);
            }}
            placeholder={placeholder}
            autoComplete="off"
            className="h-12 w-full rounded-control border border-input bg-card pr-3 pl-10 text-base"
          />
        </label>
        <button type="button" onClick={() => setScanning(true)} className="flex h-12 items-center gap-2 rounded-control bg-brand px-4 font-semibold text-white">
          <ScanLine aria-hidden="true" className="size-5" /> Scan
        </button>
      </form>
      {notice && (
        <p role="status" className="rounded-control bg-info-bg px-3 py-2 text-sm text-info">
          {notice}
        </p>
      )}
      {q && (
        <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-card">
          {results.length === 0 && <li className="p-3 text-muted">No products match.</li>}
          {results.map((p) => (
            <li key={p.id} className="space-y-2 p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold">{p.name}</span>
                <span className="text-sm text-muted">{formatStock(p.stock_units, p.base_unit_name, p.packs)}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {(unitsOnly ? optionsFor(p).slice(0, 1) : optionsFor(p)).map((o) => (
                  <button
                    key={o.key}
                    type="button"
                    onClick={() => {
                      onPick(o);
                      setQuery("");
                    }}
                    className="flex h-11 items-center gap-1.5 rounded-control border border-input bg-card px-3 text-sm font-semibold hover:border-brand"
                  >
                    <Plus aria-hidden="true" className="size-4 text-brand" />
                    {o.label}
                    {o.unitsPerPack > 1 && ` (${o.unitsPerPack})`}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
