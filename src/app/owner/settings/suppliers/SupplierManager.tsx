"use client";

import { Pencil } from "lucide-react";
import { useState, useTransition } from "react";
import { FormAlert } from "@/components/ui/form";
import { saveSupplier, type SupplierInput } from "./actions";

type Supplier = { id: string; name: string; phone: string | null; notes: string | null; is_active: boolean };

const input = "h-12 w-full rounded-control border border-input bg-card px-3 text-base";

export function SupplierManager({ suppliers }: { suppliers: Supplier[] }) {
  const [editing, setEditing] = useState<string | "new" | null>(null);

  return (
    <div className="space-y-3">
      {editing === "new" ? (
        <SupplierEditor onDone={() => setEditing(null)} />
      ) : (
        <button type="button" onClick={() => setEditing("new")} className="h-12 w-full rounded-control bg-brand font-semibold text-white">
          Add supplier
        </button>
      )}
      <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-card">
        {suppliers.length === 0 && <li className="p-4 text-muted">No suppliers yet. Staff can also add them when receiving goods.</li>}
        {suppliers.map((s) =>
          editing === s.id ? (
            <li key={s.id} className="p-3">
              <SupplierEditor supplier={s} onDone={() => setEditing(null)} />
            </li>
          ) : (
            <li key={s.id} className={`flex items-center justify-between gap-3 px-4 py-3 ${s.is_active ? "" : "opacity-60"}`}>
              <span className="min-w-0">
                <span className="block font-semibold">
                  {s.name}
                  {!s.is_active && " (hidden)"}
                </span>
                <span className="block text-sm text-muted">{[s.phone, s.notes].filter(Boolean).join(" · ") || "No details"}</span>
              </span>
              <button type="button" aria-label={`Edit ${s.name}`} onClick={() => setEditing(s.id)} className="flex size-11 items-center justify-center rounded-full hover:bg-bg">
                <Pencil aria-hidden="true" className="size-4" />
              </button>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}

function SupplierEditor({ supplier, onDone }: { supplier?: Supplier; onDone: () => void }) {
  const [form, setForm] = useState<SupplierInput>({
    name: supplier?.name ?? "",
    phone: supplier?.phone ?? "",
    notes: supplier?.notes ?? "",
    is_active: supplier?.is_active ?? true,
  });
  const [error, setError] = useState<string>();
  const [saving, startSaving] = useTransition();

  return (
    <div className="space-y-2 rounded-card border border-line bg-card p-3">
      <input className={input} aria-label="Supplier name" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      <input className={input} aria-label="Phone" placeholder="Phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
      <input className={input} aria-label="Notes" placeholder="Notes (what they supply, MoMo number…)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      {supplier && (
        <label className="flex min-h-11 items-center gap-2 font-semibold">
          <input type="checkbox" className="size-5 accent-brand" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
          Active
        </label>
      )}
      <FormAlert error={error} />
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onDone} className="h-12 rounded-control border border-input font-semibold">
          Cancel
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() =>
            startSaving(async () => {
              const r = await saveSupplier(supplier?.id ?? null, form);
              if (!r.ok) return setError(r.error);
              onDone();
            })
          }
          className="h-12 rounded-control bg-brand font-semibold text-white disabled:opacity-60"
        >
          Save
        </button>
      </div>
    </div>
  );
}
