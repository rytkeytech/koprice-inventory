"use client";

import { LoaderCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { FormAlert } from "@/components/ui/form";

type Action = {
  label: string;
  confirmLabel: string;
  tone: "primary" | "danger" | "secondary";
  /** Explains what will happen, shown before confirming. */
  explain?: string;
  reasonRequired?: boolean;
  run: (reason: string) => Promise<{ ok: true; message?: string } | { ok: false; error: string }>;
};

const tones = {
  primary: "bg-brand text-white",
  danger: "border border-danger/40 bg-card text-danger",
  secondary: "border border-input bg-card text-ink",
};

/** A row of buttons; each asks for a reason and a second tap before running. */
export function ReasonActions({ actions, reasonLabel = "Reason" }: { actions: Action[]; reasonLabel?: string }) {
  const [active, setActive] = useState<Action | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const [done, setDone] = useState<string>();
  const [pending, startTransition] = useTransition();

  if (done !== undefined) {
    return <FormAlert message={done || "Done."} />;
  }

  if (!active) {
    return (
      <div className="flex flex-wrap gap-2">
        {actions.map((a) => (
          <button key={a.label} type="button" onClick={() => setActive(a)} className={`h-12 flex-1 rounded-control px-4 font-semibold whitespace-nowrap ${tones[a.tone]}`}>
            {a.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-control border border-line bg-bg p-3">
      {active.explain && <p>{active.explain}</p>}
      <label className="block space-y-1">
        <span className="font-semibold">
          {reasonLabel}
          {active.reasonRequired ? "" : " (optional)"}
        </span>
        <input className="h-12 w-full rounded-control border border-input bg-card px-3 text-base" value={reason} onChange={(e) => setReason(e.target.value)} />
      </label>
      <FormAlert error={error} />
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => {
            setActive(null);
            setError(undefined);
          }}
          className={`h-12 rounded-control font-semibold ${tones.secondary}`}
        >
          Back
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (active.reasonRequired && !reason.trim()) return setError("Please give a reason.");
            startTransition(async () => {
              const r = await active.run(reason);
              if (r.ok) setDone(r.message ?? "");
              else setError(r.error);
            });
          }}
          className={`flex h-12 items-center justify-center gap-2 rounded-control font-semibold disabled:opacity-60 ${tones[active.tone === "secondary" ? "primary" : active.tone]}`}
        >
          {pending && <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />}
          {active.confirmLabel}
        </button>
      </div>
    </div>
  );
}
