"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/money";
import type { DailyPoint } from "@/lib/report-types";

// Series colours: brand green (retail) and accent orange (wholesale).
// Checked with the dataviz palette validator: colour-blind safe as a pair.
// Orange is low-contrast on white, so a legend and table view are always shown.
const RETAIL = "#166534";
const WHOLESALE = "#f59e0b";
const PLOT_HEIGHT = 180;

const dayLabel = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" });

function niceMax(value: number) {
  if (value <= 0) return 10;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const steps = [1, 2, 2.5, 5, 10];
  return (steps.find((s) => s * magnitude >= value) ?? 10) * magnitude;
}

function compact(n: number) {
  return n >= 1000 ? `${Math.round(n / 100) / 10}K` : String(Math.round(n));
}

/** Daily sales as stacked columns: retail (bottom) and wholesale (top). */
export function SalesChart({ data }: { data: DailyPoint[] }) {
  const [active, setActive] = useState<number | null>(null);
  const max = niceMax(Math.max(...data.map((d) => d.retail + d.wholesale), 0));
  const ticks = [0, max / 2, max];
  const labelEvery = data.length > 16 ? 7 : data.length > 7 ? 2 : 1;
  const point = active !== null ? data[active] : null;

  return (
    <figure className="space-y-3">
      <figcaption className="flex flex-wrap items-center gap-4 text-sm text-muted">
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="size-3 rounded-sm" style={{ background: RETAIL }} /> Retail
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="size-3 rounded-sm" style={{ background: WHOLESALE }} /> Wholesale
        </span>
      </figcaption>

      <div className="relative flex gap-2">
        {/* Y axis */}
        <div className="relative w-10 shrink-0 text-right text-xs text-muted" style={{ height: PLOT_HEIGHT }} aria-hidden="true">
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: PLOT_HEIGHT - (t / max) * PLOT_HEIGHT }}>
              {compact(t)}
            </span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1">
          {/* Gridlines */}
          <div className="pointer-events-none absolute inset-x-0 top-0" style={{ height: PLOT_HEIGHT }} aria-hidden="true">
            {ticks.map((t) => (
              <div key={t} className="absolute inset-x-0 border-t border-line" style={{ top: PLOT_HEIGHT - (t / max) * PLOT_HEIGHT }} />
            ))}
          </div>

          <div className="relative flex items-end gap-[2px]" style={{ height: PLOT_HEIGHT }} role="list" aria-label="Daily sales">
            {data.map((d, i) => {
              const total = d.retail + d.wholesale;
              const retailH = (d.retail / max) * PLOT_HEIGHT;
              const wholesaleH = (d.wholesale / max) * PLOT_HEIGHT;
              const label = `${dayLabel.format(new Date(`${d.date}T00:00:00Z`))}: ${formatMoney(total)} (retail ${formatMoney(d.retail)}, wholesale ${formatMoney(d.wholesale)})`;
              return (
                <button
                  key={d.date}
                  type="button"
                  role="listitem"
                  aria-label={label}
                  onMouseEnter={() => setActive(i)}
                  onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  onClick={() => setActive(active === i ? null : i)}
                  className={`flex h-full min-w-0 flex-1 flex-col items-center justify-end rounded-sm outline-offset-2 ${active === i ? "bg-bg" : ""}`}
                >
                  {/* Columns max 24px wide; 2px surface gap between segments; rounded data end only. */}
                  <span className="flex w-full max-w-6 flex-col">
                    {d.wholesale > 0 && (
                      <span className="block w-full rounded-t-[4px]" style={{ height: Math.max(wholesaleH, 2), background: WHOLESALE }} />
                    )}
                    {d.wholesale > 0 && d.retail > 0 && <span className="block h-[2px] w-full bg-card" />}
                    {d.retail > 0 && (
                      <span className={`block w-full ${d.wholesale > 0 ? "" : "rounded-t-[4px]"}`} style={{ height: Math.max(retailH, 2), background: RETAIL }} />
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          {/* X axis labels */}
          <div className="mt-1 flex gap-[2px] text-[11px] text-muted" aria-hidden="true">
            {data.map((d, i) => (
              <span key={d.date} className="min-w-0 flex-1 truncate text-center">
                {i % labelEvery === 0 ? (data.length <= 7 ? weekday.format(new Date(`${d.date}T00:00:00Z`)) : new Date(`${d.date}T00:00:00Z`).getUTCDate()) : ""}
              </span>
            ))}
          </div>

          {point && (
            <div role="status" className="pointer-events-none absolute top-0 right-0 z-10 rounded-control border border-line bg-card px-3 py-2 text-sm shadow-md">
              <p className="font-bold">{dayLabel.format(new Date(`${point.date}T00:00:00Z`))}</p>
              <p className="font-semibold">{formatMoney(point.retail + point.wholesale)}</p>
              <p className="flex items-center gap-1.5 text-muted">
                <span aria-hidden="true" className="size-2.5 rounded-sm" style={{ background: RETAIL }} /> Retail {formatMoney(point.retail)}
              </p>
              <p className="flex items-center gap-1.5 text-muted">
                <span aria-hidden="true" className="size-2.5 rounded-sm" style={{ background: WHOLESALE }} /> Wholesale {formatMoney(point.wholesale)}
              </p>
              <p className="text-muted">{point.count} sales</p>
            </div>
          )}
        </div>
      </div>

      <details className="text-sm">
        <summary className="min-h-11 cursor-pointer font-semibold text-brand">Show as table</summary>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="text-muted">
              <tr>
                <th className="py-1 pr-3">Day</th>
                <th className="py-1 pr-3 text-right">Retail</th>
                <th className="py-1 pr-3 text-right">Wholesale</th>
                <th className="py-1 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.date} className="border-t border-line">
                  <td className="py-1 pr-3">{dayLabel.format(new Date(`${d.date}T00:00:00Z`))}</td>
                  <td className="py-1 pr-3 text-right">{formatMoney(d.retail)}</td>
                  <td className="py-1 pr-3 text-right">{formatMoney(d.wholesale)}</td>
                  <td className="py-1 text-right font-semibold">{formatMoney(d.retail + d.wholesale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
