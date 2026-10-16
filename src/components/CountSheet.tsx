"use client";

import { Check, LoaderCircle } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { FormAlert } from "@/components/ui/form";
import { saveCount } from "@/lib/actions/stock-counts";
import { formatMoney } from "@/lib/money";
import { formatStock, plural } from "@/lib/stock";

export type CountItem = {
  product_id: string;
  name: string;
  base_unit: string;
  packs: { name: string; units_per_pack: number }[];
  counted_units: number | null;
  counted_by: string | null;
  expected_units: number | null;
  difference_units: number | null;
  difference_cost: number | string | null;
};

type Props = {
  countId: string;
  items: CountItem[];
  open: boolean;
  /** Owner sees expected figures and differences. */
  showExpected: boolean;
};

export function CountSheet({ countId, items: initial, open, showExpected }: Props) {
  const [items, setItems] = useState(initial);
  const [filter, setFilter] = useState<"todo" | "all">(open ? "todo" : "all");
  const [query, setQuery] = useState("");

  const done = items.filter((i) => i.counted_units !== null).length;
  const q = query.trim().toLowerCase();
  const shown = useMemo(
    () => items.filter((i) => (filter === "all" || i.counted_units === null) && (!q || i.name.toLowerCase().includes(q))),
    [items, filter, q],
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">
          {done} of {items.length} counted
        </p>
        <div role="group" aria-label="Show" className="flex rounded-control border border-input bg-card p-1">
          {(
            [
              ["todo", "Not counted"],
              ["all", "All"],
            ] as const
          ).map(([value, label]) => (
            <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={`h-10 rounded-[10px] px-3 text-sm font-semibold ${filter === value ? "bg-brand text-white" : ""}`}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <input type="search" aria-label="Find product" placeholder="Find product" value={query} onChange={(e) => setQuery(e.target.value)} className="h-12 w-full rounded-control border border-input bg-card px-3 text-base" />
      <div className="h-2 overflow-hidden rounded-full bg-line" aria-hidden="true">
        <div className="h-full bg-brand" style={{ width: `${items.length ? (done / items.length) * 100 : 0}%` }} />
      </div>

      {shown.length === 0 ? (
        <p className="rounded-card border border-dashed border-input bg-card p-4 text-center text-muted">
          {filter === "todo" ? "Everything has been counted." : "No products match."}
        </p>
      ) : (
        <ul className="space-y-2">
          {shown.map((item) => (
            <CountRow
              key={item.product_id}
              countId={countId}
              item={item}
              open={open}
              showExpected={showExpected}
              onSaved={(units) =>
                setItems((list) =>
                  list.map((i) =>
                    i.product_id === item.product_id
                      ? {
                          ...i,
                          counted_units: units,
                          // Owner's view refreshes fully on reload; keep the difference roughly right meanwhile.
                          difference_units: i.expected_units !== null ? units - i.expected_units : null,
                        }
                      : i,
                  ),
                )
              }
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function CountRow({ countId, item, open, showExpected, onSaved }: { countId: string; item: CountItem; open: boolean; showExpected: boolean; onSaved: (units: number) => void }) {
  const pack = item.packs[0];
  const [packs, setPacks] = useState("");
  const [loose, setLoose] = useState("");
  const [error, setError] = useState<string>();
  const [saving, startSaving] = useTransition();
  const units = (Number(packs) || 0) * (pack?.units_per_pack ?? 0) + (Number(loose) || 0);
  const touched = packs !== "" || loose !== "";
  const diff = item.difference_units ?? 0;

  return (
    <li className="space-y-2 rounded-card border border-line bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold">{item.name}</p>
        {item.counted_units !== null && (
          <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-brand">
            <Check aria-hidden="true" className="size-4" /> {formatStock(item.counted_units, item.base_unit, item.packs)}
          </span>
        )}
      </div>
      {showExpected && item.counted_units !== null && item.expected_units !== null && (
        <p className={`text-sm ${diff < 0 ? "font-semibold text-danger" : diff > 0 ? "text-info" : "text-muted"}`}>
          Expected {formatStock(item.expected_units, item.base_unit, item.packs)} ·{" "}
          {diff === 0 ? "matches" : `${diff > 0 ? "+" : ""}${diff} ${plural(item.base_unit, Math.abs(diff))}`}
          {item.difference_cost !== null && diff !== 0 && ` (${formatMoney(item.difference_cost)} at cost)`}
        </p>
      )}
      {open && (
        <div className="flex flex-wrap items-end gap-2">
          {pack && (
            <label className="space-y-1">
              <span className="block text-sm text-muted">{plural(pack.name, 2)}</span>
              <input aria-label={`${pack.name}s of ${item.name}`} type="number" inputMode="numeric" min="0" value={packs} onChange={(e) => setPacks(e.target.value)} className="h-12 w-24 rounded-control border border-input px-2 text-base" />
            </label>
          )}
          <label className="space-y-1">
            <span className="block text-sm text-muted">{pack ? `loose ${plural(item.base_unit, 2)}` : plural(item.base_unit, 2)}</span>
            <input aria-label={`${item.base_unit}s of ${item.name}`} type="number" inputMode="numeric" min="0" value={loose} onChange={(e) => setLoose(e.target.value)} className="h-12 w-24 rounded-control border border-input px-2 text-base" />
          </label>
          <button
            type="button"
            disabled={!touched || saving}
            onClick={() =>
              startSaving(async () => {
                setError(undefined);
                const r = await saveCount(countId, item.product_id, units);
                if (!r.ok) return setError(r.error);
                onSaved(units);
                setPacks("");
                setLoose("");
              })
            }
            className="flex h-12 items-center gap-2 rounded-control bg-brand px-4 font-semibold text-white disabled:opacity-40"
          >
            {saving && <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />}
            {item.counted_units !== null ? "Recount" : "Save"}
          </button>
          {touched && pack && <span className="pb-3 text-sm text-muted">= {units} {plural(item.base_unit, units)}</span>}
        </div>
      )}
      <FormAlert error={error} />
    </li>
  );
}
