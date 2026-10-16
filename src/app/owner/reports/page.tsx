import type { Metadata } from "next";
import Link from "next/link";
import { SalesChart } from "@/components/SalesChart";
import { accraDateDaysAgo, formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { percentChange, periodFor, type PeriodKey } from "@/lib/periods";
import type { Dashboard, SalesReport } from "@/lib/report-types";
import { createClient } from "@/lib/supabase/server";
import { ExcelButton } from "./ExcelButton";

export const metadata: Metadata = { title: "Reports" };

const KEYS: PeriodKey[] = ["today", "week", "month"];

export default async function ReportsPage({ searchParams }: PageProps<"/owner/reports">) {
  const params = await searchParams;
  const key = KEYS.includes(params.period as PeriodKey) ? (params.period as PeriodKey) : "week";
  const period = periodFor(key, accraDateDaysAgo(0));
  const supabase = await createClient();
  const [now, before, report] = await Promise.all([
    supabase.rpc("owner_dashboard", { p_from: period.from, p_to: period.to }),
    supabase.rpc("owner_dashboard", { p_from: period.prevFrom, p_to: period.prevTo }),
    supabase.rpc("sales_report", { p_from: period.from, p_to: period.to }),
  ]);
  if (now.error || !now.data || !report.data) {
    return <p className="rounded-control bg-danger/10 p-3 text-danger">Could not load the report. Please reload.</p>;
  }
  const d = now.data as unknown as Dashboard;
  const p = before.data as unknown as Dashboard | null;
  const r = report.data as unknown as SalesReport;

  const tiles = [
    { label: "Sales", value: d.sales_total, prev: p?.sales_total },
    { label: "Gross profit", value: d.profit, prev: p?.profit },
    { label: "Expenses", value: d.expenses, prev: p?.expenses, lowerIsBetter: true },
    { label: "Profit after expenses", value: d.profit - d.expenses, prev: p ? p.profit - p.expenses : undefined },
  ];
  // The daily chart only makes sense for more than one day; for today show a split instead.
  const multiDay = r.daily.length > 1;

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand">Reports</h1>
          <p className="text-muted">
            {formatDate(period.from)}
            {period.from !== period.to && ` – ${formatDate(period.to)}`} · compared with {period.prevLabel}
          </p>
        </div>
        <ExcelButton dashboard={d} report={r} label={period.label} />
      </div>

      <nav aria-label="Period" className="flex gap-2">
        {KEYS.map((k) => (
          <Link
            key={k}
            href={`?period=${k}`}
            aria-current={k === key ? "page" : undefined}
            className={`flex h-11 items-center rounded-full px-4 font-semibold ${k === key ? "bg-brand text-white" : "border border-input bg-card"}`}
          >
            {periodFor(k, period.to).label}
          </Link>
        ))}
      </nav>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => {
          const change = t.prev !== undefined ? percentChange(t.value, t.prev) : null;
          const good = change !== null && (t.lowerIsBetter ? change <= 0 : change >= 0);
          return (
            <div key={t.label} className="rounded-card border border-line bg-card p-4">
              <p className="text-sm text-muted">{t.label}</p>
              <p className="text-xl font-extrabold sm:text-2xl">{formatMoney(t.value)}</p>
              {change !== null && (
                <p className={`text-sm font-semibold ${good ? "text-brand" : "text-danger"}`}>
                  {change >= 0 ? "▲" : "▼"} {Math.abs(change)}%
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-2 rounded-card border border-line bg-card p-4">
          <h2 className="font-bold">Daily sales</h2>
          {multiDay ? (
            <SalesChart data={r.daily} />
          ) : (
            <p className="text-muted">
              Retail {formatMoney(d.retail)} · Wholesale {formatMoney(d.wholesale)}. Choose This week or This month to see the daily chart.
            </p>
          )}
        </div>
        <dl className="space-y-2 rounded-card border border-line bg-card p-4 text-sm">
          <h2 className="text-base font-bold">Money</h2>
          <Row label="Cash" value={d.cash} />
          <Row label="MoMo" value={d.momo} />
          <Row label="Credit given" value={r.credit_given} />
          <Row label="Credit paid back" value={r.credit_repaid} />
          <Row label="Discounts" value={d.signals.discount_total} />
          <Row label="Stock value at cost (now)" value={d.stock_value} />
          <Row label="Missing stock (counts)" value={d.missing_value} danger={d.missing_value > 0} />
          <Row label="Cash shortages" value={d.shortages} danger={d.shortages > 0} />
          {Object.entries(r.expenses).map(([cat, amount]) => (
            <Row key={cat} label={`Expense: ${cat}`} value={amount} />
          ))}
        </dl>
      </div>

      <Table
        title="Best sellers"
        empty="No sales in this period."
        head={["Product", "Sold", "Sales", "Profit"]}
        rows={r.best_sellers.map((b) => [
          <Link key="n" href={`/owner/stock/${b.product_id}`} className="font-semibold text-brand">
            {b.name}
          </Link>,
          `${b.units} ${b.base_unit}s`,
          formatMoney(b.revenue),
          formatMoney(b.profit),
        ])}
      />

      <Table
        title="Slow movers (not sold in this period)"
        empty="Every product in stock sold at least once."
        head={["Product", "In stock", "Value at cost", "Last sold"]}
        rows={r.slow_movers.map((s) => [
          <Link key="n" href={`/owner/stock/${s.product_id}`} className="font-semibold text-brand">
            {s.name}
          </Link>,
          `${s.stock_units} ${s.base_unit}s`,
          formatMoney(s.stock_value),
          s.last_sold ? formatDate(s.last_sold) : "Never",
        ])}
      />

      <Table
        title="Sales per attendant"
        empty="No sales in this period."
        head={["Name", "Sales", "Days", "Discounts", "Refunds / cancelled"]}
        rows={r.attendants.map((a) => [a.name, `${formatMoney(a.total ?? 0)} (${a.count})`, String(a.days), formatMoney(a.discounts), String(a.refunds_voids)])}
      />
    </section>
  );
}

function Row({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted capitalize">{label}</dt>
      <dd className={`font-semibold ${danger ? "text-danger" : ""}`}>{formatMoney(value)}</dd>
    </div>
  );
}

function Table({ title, head, rows, empty }: { title: string; head: string[]; rows: React.ReactNode[][]; empty: string }) {
  return (
    <div className="space-y-2">
      <h2 className="text-lg font-bold">{title}</h2>
      {rows.length === 0 ? (
        <p className="rounded-card border border-dashed border-input bg-card p-4 text-muted">{empty}</p>
      ) : (
        <div className="overflow-x-auto rounded-card border border-line bg-card">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="bg-bg text-muted">
              <tr>
                {head.map((h, i) => (
                  <th key={h} className={`px-3 py-2 font-semibold ${i > 0 ? "text-right" : ""}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j} className={`px-3 py-2 ${j > 0 ? "text-right" : ""}`}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
