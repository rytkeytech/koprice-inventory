"use client";

import { LoaderCircle, X } from "lucide-react";
import { useState, useTransition } from "react";
import { ProductPicker } from "@/components/ProductPicker";
import { FormAlert } from "@/components/ui/form";
import { adjustStock, requestApproval } from "@/lib/actions/approvals";
import type { Product } from "@/lib/catalogue";
import type { SellOptionView } from "@/lib/sell-options";
import { formatStock } from "@/lib/stock";

const REASONS = [
  { value: "adjust_damaged", label: "Damaged" },
  { value: "adjust_expired", label: "Expired" },
  { value: "adjust_stolen", label: "Missing / stolen" },
];

const input = "h-12 w-full rounded-control border border-input bg-card px-3 text-base";

/**
 * Remove damaged/expired/missing stock.
 * mode "request": attendant asks the owner. mode "owner": applied at once.
 */
export function StockProblemForm({ products, mode }: { products: Product[]; mode: "request" | "owner" }) {
  const [picked, setPicked] = useState<SellOptionView | null>(null);
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("adjust_damaged");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();
  const [done, setDone] = useState<string>();
  const [saving, startSaving] = useTransition();

  const units = (Number(qty) || 0) * (picked?.unitsPerPack ?? 1);

  function submit() {
    setError(undefined);
    if (!picked) return setError("Choose the product.");
    if (units <= 0) return setError("Enter how many.");
    if (!note.trim()) return setError("Say what happened.");
    startSaving(async () => {
      const r =
        mode === "owner"
          ? await adjustStock(picked.product.id, -units, reason, note)
          : await requestApproval("stock_adjustment", { product_id: picked.product.id, units, adjust_reason: reason, reason: note });
      if (!r.ok) return setError(r.error);
      setDone(mode === "owner" ? `${units} ${picked.product.base_unit_name}s of ${picked.product.name} removed from stock.` : "Sent to the owner.");
      setPicked(null);
      setQty("");
      setNote("");
    });
  }

  return (
    <div className="space-y-3">
      {done && <FormAlert message={done} />}
      {picked ? (
        <div className="flex items-start justify-between gap-3 rounded-control border border-brand bg-success-bg p-3">
          <span>
            <span className="block font-bold">
              {picked.product.name}
              {picked.packId && ` (${picked.label} of ${picked.unitsPerPack})`}
            </span>
            <span className="text-sm text-muted">In stock: {formatStock(picked.product.stock_units, picked.product.base_unit_name, picked.product.packs)}</span>
          </span>
          <button type="button" aria-label="Choose another product" onClick={() => setPicked(null)} className="flex size-11 items-center justify-center">
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>
      ) : (
        <ProductPicker
          products={products}
          onPick={(o) => {
            setPicked(o);
            setDone(undefined);
          }}
        />
      )}

      {picked && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className="font-semibold">How many {picked.label}s</span>
              <input className={input} type="number" inputMode="numeric" min="1" value={qty} onChange={(e) => setQty(e.target.value)} />
            </label>
            <label className="block space-y-1">
              <span className="font-semibold">What happened</span>
              <select className={input} value={reason} onChange={(e) => setReason(e.target.value)}>
                {REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {units > 0 && picked.unitsPerPack > 1 && (
            <p className="text-sm text-muted">
              = {units} {picked.product.base_unit_name}s
            </p>
          )}
          <label className="block space-y-1">
            <span className="font-semibold">Details</span>
            <input className={input} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Rat damage in store room" />
          </label>
          <FormAlert error={error} />
          <button type="button" disabled={saving} onClick={submit} className="flex h-14 w-full items-center justify-center gap-2 rounded-control bg-brand text-lg font-bold text-white disabled:opacity-60">
            {saving && <LoaderCircle aria-hidden="true" className="size-5 animate-spin" />}
            {mode === "owner" ? "Remove from stock" : "Send to owner"}
          </button>
        </>
      )}
    </div>
  );
}

/** Attendant: tell the owner a price is wrong. */
export function PriceChangeForm({ products }: { products: Product[] }) {
  const [picked, setPicked] = useState<SellOptionView | null>(null);
  const [retail, setRetail] = useState("");
  const [wholesale, setWholesale] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();
  const [done, setDone] = useState<string>();
  const [saving, startSaving] = useTransition();

  return (
    <div className="space-y-3">
      {done && <FormAlert message={done} />}
      {picked ? (
        <div className="flex items-start justify-between gap-3 rounded-control border border-brand bg-success-bg p-3">
          <span>
            <span className="block font-bold">
              {picked.product.name} ({picked.label})
            </span>
            <span className="text-sm text-muted">
              Now: retail GH₵ {picked.retail.toFixed(2)} · wholesale GH₵ {picked.wholesale.toFixed(2)}
            </span>
          </span>
          <button type="button" aria-label="Choose another product" onClick={() => setPicked(null)} className="flex size-11 items-center justify-center">
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>
      ) : (
        <ProductPicker
          products={products}
          onPick={(o) => {
            setPicked(o);
            setRetail(o.retail.toFixed(2));
            setWholesale(o.wholesale.toFixed(2));
            setDone(undefined);
          }}
        />
      )}
      {picked && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className="font-semibold">New retail (GH₵)</span>
              <input className={input} type="number" inputMode="decimal" step="0.01" value={retail} onChange={(e) => setRetail(e.target.value)} />
            </label>
            <label className="block space-y-1">
              <span className="font-semibold">New wholesale (GH₵)</span>
              <input className={input} type="number" inputMode="decimal" step="0.01" value={wholesale} onChange={(e) => setWholesale(e.target.value)} />
            </label>
          </div>
          <label className="block space-y-1">
            <span className="font-semibold">Why</span>
            <input className={input} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Supplier price went up" />
          </label>
          <FormAlert error={error} />
          <button
            type="button"
            disabled={saving}
            onClick={() =>
              startSaving(async () => {
                setError(undefined);
                const r = await requestApproval("price_change", {
                  product_id: picked.product.id,
                  pack_id: picked.packId,
                  retail_price: Number(retail),
                  wholesale_price: Number(wholesale),
                  reason: note,
                });
                if (!r.ok) return setError(r.error);
                setDone("Sent to the owner.");
                setPicked(null);
                setNote("");
              })
            }
            className="flex h-14 w-full items-center justify-center gap-2 rounded-control bg-brand text-lg font-bold text-white disabled:opacity-60"
          >
            {saving && <LoaderCircle aria-hidden="true" className="size-5 animate-spin" />}
            Send to owner
          </button>
        </>
      )}
    </div>
  );
}
