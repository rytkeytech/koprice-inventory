"use client";

import { LoaderCircle, X } from "lucide-react";
import { useState, useTransition } from "react";
import { ProductPicker } from "@/components/ProductPicker";
import { FormAlert } from "@/components/ui/form";
import { startCount } from "@/lib/actions/stock-counts";
import type { Product } from "@/lib/catalogue";
import { isLowStock } from "@/lib/stock";

export function StartCountForm({ products, lowStockDefault }: { products: Product[]; lowStockDefault: number }) {
  const [type, setType] = useState<"spot" | "full">("spot");
  const [chosen, setChosen] = useState<Product[]>([]);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();
  const [saving, startSaving] = useTransition();

  const add = (p: Product) => setChosen((c) => (c.some((x) => x.id === p.id) ? c : [...c, p]));
  // Quick picks: fast-moving or valuable items are the ones that go missing.
  const suggestions = [
    { label: "Quick sell items", list: products.filter((p) => p.is_quick_sell) },
    { label: "Low stock items", list: products.filter((p) => isLowStock(p.stock_units, p.reorder_level, lowStockDefault)) },
  ].filter((s) => s.list.length > 0);
  // Picked when tapped (not during render) so the choice is truly random.
  const addRandom = () => [...products].sort(() => Math.random() - 0.5).slice(0, 10).forEach(add);

  return (
    <div className="space-y-4">
      <div role="group" aria-label="Count type" className="grid grid-cols-2 gap-2">
        {(
          [
            ["spot", "Spot count", "A few products"],
            ["full", "Full count", `All ${products.length} products`],
          ] as const
        ).map(([value, label, note]) => (
          <button key={value} type="button" aria-pressed={type === value} onClick={() => setType(value)} className={`min-h-16 rounded-control px-3 text-left ${type === value ? "bg-brand text-white" : "border border-input bg-card"}`}>
            <span className="block font-bold">{label}</span>
            <span className="block text-sm opacity-80">{note}</span>
          </button>
        ))}
      </div>

      {type === "spot" && (
        <div className="space-y-3 rounded-card border border-line bg-card p-4">
          <p className="font-semibold">Products to count ({chosen.length})</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button key={s.label} type="button" onClick={() => s.list.forEach(add)} className="h-10 rounded-full border border-input px-3 text-sm font-semibold">
                + {s.label}
              </button>
            ))}
            {products.length > 0 && (
              <button type="button" onClick={addRandom} className="h-10 rounded-full border border-input px-3 text-sm font-semibold">
                + 10 random items
              </button>
            )}
          </div>
          <ProductPicker products={products} unitsOnly onPick={(o) => add(o.product)} placeholder="Add a product to count" />
          {chosen.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {chosen.map((p) => (
                <li key={p.id} className="flex items-center gap-1 rounded-full bg-success-bg py-1 pr-1 pl-3 text-sm font-semibold">
                  {p.name}
                  <button type="button" aria-label={`Remove ${p.name}`} onClick={() => setChosen((c) => c.filter((x) => x.id !== p.id))} className="flex size-8 items-center justify-center rounded-full">
                    <X aria-hidden="true" className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <label className="block space-y-1">
        <span className="font-semibold">Note (optional)</span>
        <input className="h-12 w-full rounded-control border border-input bg-card px-3 text-base" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Monday visit" />
      </label>
      <FormAlert error={error} />
      <button
        type="button"
        disabled={saving}
        onClick={() =>
          startSaving(async () => {
            setError(undefined);
            const r = await startCount(type, chosen.map((p) => p.id), note);
            if (r && !r.ok) setError(r.error);
          })
        }
        className="flex h-14 w-full items-center justify-center gap-2 rounded-control bg-brand text-lg font-bold text-white disabled:opacity-60"
      >
        {saving && <LoaderCircle aria-hidden="true" className="size-5 animate-spin" />}
        Start count
      </button>
    </div>
  );
}
