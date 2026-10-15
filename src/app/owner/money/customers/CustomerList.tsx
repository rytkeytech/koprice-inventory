"use client";

import Link from "next/link";
import { useState } from "react";
import { formatMoney } from "@/lib/money";

type Row = {
  id: string;
  name: string;
  phone: string | null;
  type: string;
  balance: number;
  credit_limit: number;
  is_active: boolean;
};

export function CustomerList({ customers }: { customers: Row[] }) {
  const [query, setQuery] = useState("");
  const [showHidden, setShowHidden] = useState(false);
  const q = query.trim().toLowerCase();
  const rows = customers.filter(
    (c) => (showHidden || c.is_active) && (!q || c.name.toLowerCase().includes(q) || (c.phone ?? "").includes(q)),
  );

  return (
    <div className="space-y-3">
      <input
        type="search"
        aria-label="Search customers"
        placeholder="Search by name or phone"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="h-12 w-full rounded-control border border-input bg-card px-3 text-base"
      />
      <label className="flex min-h-11 items-center gap-2 text-sm text-muted">
        <input type="checkbox" className="size-5 accent-brand" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} />
        Show hidden customers
      </label>
      {rows.length === 0 ? (
        <p className="rounded-card border border-dashed border-input bg-card p-6 text-center text-muted">No customers found.</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-card">
          {rows.map((c) => (
            <li key={c.id}>
              <Link href={`/owner/money/customers/${c.id}`} className={`flex min-h-14 items-center justify-between gap-3 px-4 py-2 hover:bg-bg ${c.is_active ? "" : "opacity-60"}`}>
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{c.name}</span>
                  <span className="block text-sm text-muted">
                    {c.phone ?? "No phone"} · {c.type} · limit {formatMoney(c.credit_limit)}
                  </span>
                </span>
                <span className={`shrink-0 font-bold ${c.balance > 0 ? "text-warning" : "text-muted"}`}>{formatMoney(c.balance)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
