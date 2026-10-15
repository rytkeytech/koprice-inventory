"use client";

import { LoaderCircle, Search, UserPlus } from "lucide-react";
import { useState, useTransition } from "react";
import { FormAlert } from "@/components/ui/form";
import { formatMoney } from "@/lib/money";
import { addCustomer } from "./actions";
import type { SellCustomer } from "@/lib/sell-options";

type Props = {
  customers: SellCustomer[];
  selected: SellCustomer | null;
  onSelect: (customer: SellCustomer | null) => void;
};

const input = "h-12 w-full rounded-control border border-input bg-card px-3 text-base";

/** Search existing customers or add a new one (new customers start with no credit limit). */
export function CustomerPicker({ customers, selected, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [type, setType] = useState<"retail" | "wholesale">("retail");
  const [error, setError] = useState<string>();
  const [saving, startSaving] = useTransition();
  const [extra, setExtra] = useState<SellCustomer[]>([]);

  if (selected) {
    const over = selected.balance >= selected.credit_limit;
    return (
      <div className="flex items-start justify-between gap-3 rounded-control border border-brand bg-success-bg p-3">
        <div>
          <p className="font-bold">{selected.name}</p>
          <p className="text-sm text-muted">{selected.phone ?? "No phone"}</p>
          <p className="text-sm">
            Owes <strong>{formatMoney(selected.balance)}</strong> · Limit {formatMoney(selected.credit_limit)}
          </p>
          {over && selected.credit_limit > 0 && <p className="text-sm font-semibold text-warning">At or over credit limit</p>}
        </div>
        <button type="button" onClick={() => onSelect(null)} className="min-h-11 text-sm font-semibold text-brand">
          Change
        </button>
      </div>
    );
  }

  const all = [...extra, ...customers];
  const q = query.trim().toLowerCase();
  const matches = q ? all.filter((c) => c.name.toLowerCase().includes(q) || (c.phone ?? "").includes(q)).slice(0, 8) : all.slice(0, 5);

  if (adding) {
    return (
      <div className="space-y-3 rounded-control border border-line p-3">
        <p className="font-semibold">New customer</p>
        <label className="block space-y-1">
          <span className="text-sm font-semibold">Name</span>
          <input className={input} value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-semibold">Phone (for WhatsApp)</span>
          <input className={input} type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="024 123 4567" />
        </label>
        <div role="group" aria-label="Customer type" className="grid grid-cols-2 gap-2">
          {(["retail", "wholesale"] as const).map((t) => (
            <button key={t} type="button" aria-pressed={type === t} onClick={() => setType(t)} className={`h-11 rounded-control font-semibold capitalize ${type === t ? "bg-brand text-white" : "border border-input"}`}>
              {t}
            </button>
          ))}
        </div>
        <p className="text-sm text-muted">New customers have no credit limit until the owner sets one.</p>
        <FormAlert error={error} />
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setAdding(false)} className="h-12 rounded-control border border-input font-semibold">
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() =>
              startSaving(async () => {
                setError(undefined);
                const result = await addCustomer({ name, phone, type });
                if (!result.ok) return setError(result.error);
                setExtra((e) => [result.customer, ...e]);
                onSelect(result.customer);
                setAdding(false);
              })
            }
            className="flex h-12 items-center justify-center gap-2 rounded-control bg-brand font-semibold text-white disabled:opacity-60"
          >
            {saving && <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />}
            Save customer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="relative block">
        <span className="sr-only">Find customer</span>
        <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted" />
        <input type="search" className={`${input} pl-10`} placeholder="Find customer by name or phone" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      <ul className="divide-y divide-line overflow-hidden rounded-control border border-line">
        {matches.map((c) => (
          <li key={c.id}>
            <button type="button" onClick={() => onSelect(c)} className="flex min-h-12 w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-bg">
              <span>
                <span className="block font-semibold">{c.name}</span>
                <span className="block text-sm text-muted">{c.phone ?? ""}</span>
              </span>
              <span className="text-right text-sm">
                {c.balance > 0 ? <span className="font-semibold text-warning">Owes {formatMoney(c.balance)}</span> : <span className="text-muted">Owes nothing</span>}
              </span>
            </button>
          </li>
        ))}
        {matches.length === 0 && <li className="px-3 py-3 text-muted">No customer found.</li>}
      </ul>
      <button type="button" onClick={() => { setAdding(true); setName(query); }} className="flex h-12 items-center gap-2 font-semibold text-brand">
        <UserPlus aria-hidden="true" className="size-5" /> Add new customer
      </button>
    </div>
  );
}
