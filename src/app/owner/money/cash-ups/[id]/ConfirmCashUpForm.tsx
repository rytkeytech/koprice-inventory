"use client";

import { LoaderCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { FormAlert } from "@/components/ui/form";
import { confirmCashUp } from "@/lib/actions/cash-ups";
import { formatMoney } from "@/lib/money";

export function ConfirmCashUpForm({ id, expectedCash, amountHanded }: { id: string; expectedCash: number; amountHanded: number }) {
  const [amount, setAmount] = useState(amountHanded.toFixed(2));
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();
  const [saving, startSaving] = useTransition();
  const shortage = Math.round((expectedCash - (Number(amount) || 0)) * 100) / 100;

  return (
    <div className="space-y-3 rounded-card border border-line bg-card p-4">
      <h2 className="text-lg font-bold">Count the money</h2>
      <label className="block space-y-1">
        <span className="font-semibold">Amount you received (GH₵)</span>
        <input className="h-12 w-full rounded-control border border-input px-3 text-xl font-bold" type="number" inputMode="decimal" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </label>
      <p className={`rounded-control p-3 font-semibold ${shortage > 0 ? "bg-danger/10 text-danger" : "bg-success-bg text-brand"}`}>
        {shortage > 0 ? `Short by ${formatMoney(shortage)}` : shortage < 0 ? `${formatMoney(-shortage)} more than expected` : "Matches what was expected"}
      </p>
      <label className="block space-y-1">
        <span className="font-semibold">Note (optional)</span>
        <input className="h-12 w-full rounded-control border border-input px-3 text-base" value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <FormAlert error={error} />
      <button
        type="button"
        disabled={saving}
        onClick={() =>
          startSaving(async () => {
            setError(undefined);
            const r = await confirmCashUp(id, Number(amount), note);
            if (!r.ok) setError(r.error);
          })
        }
        className="flex h-14 w-full items-center justify-center gap-2 rounded-control bg-brand text-lg font-bold text-white disabled:opacity-60"
      >
        {saving && <LoaderCircle aria-hidden="true" className="size-5 animate-spin" />}
        {shortage > 0 ? "Record shortage" : "Confirm"}
      </button>
    </div>
  );
}
