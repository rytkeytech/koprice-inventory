"use client";

import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FormAlert } from "@/components/ui/form";
import { formatMoney } from "@/lib/money";
import { checkDelivery } from "./actions";

export type DeliveryItem = {
  id: string;
  name: string;
  base_unit: string;
  pack_name: string | null;
  units_per_pack: number;
  qty: number;
  units: number;
  cost_per_unit: number | null;
  cost_is_set: boolean | null;
};

export function DeliveryReview({ deliveryId, items, status }: { deliveryId: string; items: DeliveryItem[]; status: string }) {
  const router = useRouter();
  // Costs are typed per pack/unit as delivered, pre-filled from the current cost.
  const [costs, setCosts] = useState<Record<string, string>>(() =>
    Object.fromEntries(items.map((i) => [i.id, i.cost_per_unit != null ? (i.cost_per_unit * i.units_per_pack).toFixed(2) : ""])),
  );
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();
  const [saving, startSaving] = useTransition();

  const total = items.reduce((sum, i) => sum + (Number(costs[i.id]) || 0) * i.qty, 0);
  const missing = items.filter((i) => costs[i.id].trim() === "").length;

  const submit = (next: "confirmed" | "queried") =>
    startSaving(async () => {
      setError(undefined);
      const result = await checkDelivery({
        deliveryId,
        status: next,
        note,
        costs: items.map((i) => ({
          delivery_item_id: i.id,
          cost_per_unit: costs[i.id].trim() === "" ? null : Number(costs[i.id]) / i.units_per_pack,
        })),
      });
      if (!result.ok) return setError(result.error);
      router.push("/owner/approvals");
    });

  if (status === "confirmed") {
    return (
      <ul className="divide-y divide-line rounded-card border border-line bg-card">
        {items.map((i) => (
          <li key={i.id} className="flex justify-between gap-3 px-4 py-3">
            <span>
              {i.qty} × {i.name} {i.pack_name ? `(${i.pack_name})` : ""}
            </span>
            <span className="text-muted">{i.cost_per_unit != null ? `${formatMoney(i.cost_per_unit * i.units_per_pack)} each` : "No cost"}</span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="space-y-4">
      <ul className="divide-y divide-line rounded-card border border-line bg-card">
        {items.map((i) => (
          <li key={i.id} className="space-y-2 px-4 py-3">
            <p className="font-semibold">
              {i.qty} × {i.name} {i.pack_name ? `(${i.pack_name} of ${i.units_per_pack})` : ""}
              <span className="block text-sm font-normal text-muted">
                = {i.units} {i.base_unit}s added to stock
              </span>
            </p>
            <label className="flex items-center gap-2 text-sm">
              <span className="shrink-0">Cost per {i.pack_name ?? i.base_unit} (GH₵)</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={costs[i.id]}
                onChange={(e) => setCosts((c) => ({ ...c, [i.id]: e.target.value }))}
                className="h-11 w-28 rounded-control border border-input px-2 text-base"
              />
              {costs[i.id] && <span className="text-muted">× {i.qty} = {formatMoney((Number(costs[i.id]) || 0) * i.qty)}</span>}
            </label>
          </li>
        ))}
      </ul>

      <p className="text-right text-lg">
        Invoice total: <strong>{formatMoney(total)}</strong>
        {missing > 0 && <span className="block text-sm text-warning">{missing} item(s) have no cost (the current cost is kept).</span>}
      </p>

      <label className="block space-y-1">
        <span className="font-semibold">Note (needed to query)</span>
        <input className="h-12 w-full rounded-control border border-input px-3 text-base" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Invoice says 12 cartons, only 10 counted" />
      </label>

      <FormAlert error={error} />
      <div className="grid grid-cols-2 gap-3">
        <button type="button" disabled={saving} onClick={() => submit("queried")} className="h-14 rounded-control border border-danger/40 bg-card font-bold text-danger disabled:opacity-60">
          Query
        </button>
        <button type="button" disabled={saving} onClick={() => submit("confirmed")} className="flex h-14 items-center justify-center gap-2 rounded-control bg-brand font-bold text-white disabled:opacity-60">
          {saving && <LoaderCircle aria-hidden="true" className="size-5 animate-spin" />}
          Confirm
        </button>
      </div>
      <p className="text-sm text-muted">
        If the quantity was wrong, query it here, then fix stock with a stock count or Damaged / expired.
      </p>
    </div>
  );
}
