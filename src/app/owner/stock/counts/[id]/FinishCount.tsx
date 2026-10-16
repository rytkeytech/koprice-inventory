"use client";

import { LoaderCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { FormAlert } from "@/components/ui/form";
import { finishCount } from "@/lib/actions/stock-counts";

export function FinishCount({ countId, uncounted }: { countId: string; uncounted: number }) {
  const [error, setError] = useState<string>();
  const [choice, setChoice] = useState<boolean | null>(null);
  const [saving, startSaving] = useTransition();

  const run = (apply: boolean) =>
    startSaving(async () => {
      setError(undefined);
      const r = await finishCount(countId, apply);
      if (!r.ok) setError(r.error);
    });

  return (
    <div className="space-y-3 rounded-card border border-line bg-card p-4">
      <h2 className="text-lg font-bold">Finish the count</h2>
      {uncounted > 0 && <p className="rounded-control bg-warning-bg p-3 text-warning">{uncounted} product(s) not counted yet. They will be left out.</p>}
      {choice === null ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={() => setChoice(true)} className="min-h-14 rounded-control bg-brand px-3 font-bold text-white">
            Finish and correct stock
          </button>
          <button type="button" onClick={() => setChoice(false)} className="min-h-14 rounded-control border border-input px-3 font-bold">
            Finish, just record
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <p>
            {choice
              ? "Stock will be changed to what was counted (as count corrections in the stock history). The missing value is kept in the report."
              : "Stock stays as it is. Use this if you want to recount before changing anything."}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setChoice(null)} className="h-12 rounded-control border border-input font-semibold">
              Back
            </button>
            <button type="button" disabled={saving} onClick={() => run(choice)} className="flex h-12 items-center justify-center gap-2 rounded-control bg-brand font-semibold text-white disabled:opacity-60">
              {saving && <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />}
              Yes, finish
            </button>
          </div>
        </div>
      )}
      <FormAlert error={error} />
    </div>
  );
}
