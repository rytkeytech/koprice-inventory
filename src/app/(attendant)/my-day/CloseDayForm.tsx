"use client";

import { LoaderCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { FormAlert } from "@/components/ui/form";
import { closeDay } from "@/lib/actions/cash-ups";
import { formatMoney } from "@/lib/money";

const input = "h-12 w-full rounded-control border border-input bg-card px-3 text-base";

export function CloseDayForm({ businessDate, expectedCash, heldCount }: { businessDate: string; expectedCash: number; heldCount: number }) {
  const [method, setMethod] = useState<"safe" | "momo">("safe");
  const [amount, setAmount] = useState(expectedCash.toFixed(2));
  const [txn, setTxn] = useState("");
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string>();
  const [saving, startSaving] = useTransition();

  const handed = Number(amount) || 0;
  const difference = Math.round((handed - expectedCash) * 100) / 100;

  return (
    <div className="space-y-4 rounded-card border border-line bg-card p-4">
      <h2 className="text-lg font-bold">Hand over the cash</h2>
      <div role="group" aria-label="How are you handing over the cash" className="grid grid-cols-2 gap-2">
        {(
          [
            ["safe", "Put in shop safe"],
            ["momo", "Sent by MoMo"],
          ] as const
        ).map(([value, label]) => (
          <button key={value} type="button" aria-pressed={method === value} onClick={() => setMethod(value)} className={`min-h-14 rounded-control px-2 font-bold ${method === value ? "bg-brand text-white" : "border border-input"}`}>
            {label}
          </button>
        ))}
      </div>
      <label className="block space-y-1">
        <span className="font-semibold">Amount handed over (GH₵)</span>
        <input className={`${input} text-xl font-bold`} type="number" inputMode="decimal" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </label>
      {method === "momo" && (
        <label className="block space-y-1">
          <span className="font-semibold">MoMo transaction ID</span>
          <input className={input} value={txn} onChange={(e) => setTxn(e.target.value)} autoComplete="off" />
        </label>
      )}
      {difference !== 0 && (
        <p className={`rounded-control p-3 ${difference < 0 ? "bg-warning-bg text-warning" : "bg-info-bg text-info"}`}>
          {difference < 0 ? `This is ${formatMoney(-difference)} less than expected.` : `This is ${formatMoney(difference)} more than expected.`} Add a note to explain.
        </p>
      )}
      <label className="block space-y-1">
        <span className="font-semibold">Note {difference !== 0 ? "" : "(optional)"}</span>
        <input className={input} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      {heldCount > 0 && (
        <p className="rounded-control bg-warning-bg p-3 text-warning">
          {heldCount} sale{heldCount === 1 ? " is" : "s are"} still waiting for the owner. They are not in the totals above.
        </p>
      )}
      <FormAlert error={error} />
      {confirming ? (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setConfirming(false)} className="h-14 rounded-control border border-input font-semibold">
            Back
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() =>
              startSaving(async () => {
                setError(undefined);
                if (difference !== 0 && !note.trim()) {
                  setConfirming(false);
                  return setError("Please add a note explaining the difference.");
                }
                const r = await closeDay({ businessDate, method, amount: handed, momoTxnId: txn, note });
                if (!r.ok) {
                  setConfirming(false);
                  setError(r.error);
                }
              })
            }
            className="flex h-14 items-center justify-center gap-2 rounded-control bg-accent font-bold text-ink disabled:opacity-60"
          >
            {saving && <LoaderCircle aria-hidden="true" className="size-5 animate-spin" />}
            Yes, close my day
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} className="h-[58px] w-full rounded-control bg-accent text-lg font-bold text-ink">
          Close my day
        </button>
      )}
      {confirming && <p className="text-center text-sm text-muted">After closing, you can&apos;t change today&apos;s cash-up.</p>}
    </div>
  );
}
