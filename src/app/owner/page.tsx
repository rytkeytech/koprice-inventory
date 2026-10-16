import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, ChevronRight, ClipboardCheck, HandCoins, PackageX, SearchX, Share2, Wallet } from "lucide-react";
import { accraDateDaysAgo, formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { percentChange } from "@/lib/periods";
import type { Dashboard } from "@/lib/report-types";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Home" };

export default async function OwnerHomePage() {
  const supabase = await createClient();
  const today = accraDateDaysAgo(0);
  const yesterday = accraDateDaysAgo(1);
  const monthAgo = accraDateDaysAgo(29);
  const [todayRes, yesterdayRes, monthRes] = await Promise.all([
    supabase.rpc("owner_dashboard", { p_from: today, p_to: today }),
    supabase.rpc("owner_dashboard", { p_from: yesterday, p_to: yesterday }),
    supabase.rpc("owner_dashboard", { p_from: monthAgo, p_to: today }),
  ]);
  if (todayRes.error || !todayRes.data) {
    return <p className="rounded-control bg-danger/10 p-3 text-danger">Could not load today&apos;s figures. Please reload.</p>;
  }
  const d = todayRes.data as unknown as Dashboard;
  const y = yesterdayRes.data as unknown as Dashboard | null;
  const m = monthRes.data as unknown as Dashboard | null;
  const change = y ? percentChange(d.sales_total, y.sales_total) : null;
  const waiting = d.pending.requests + d.pending.deliveries + d.pending.cash_ups + d.pending.expenses;

  const signals = [
    d.signals.discounts > 0 && `${d.signals.discounts} discount${d.signals.discounts === 1 ? "" : "s"} (${formatMoney(d.signals.discount_total)})`,
    d.signals.refunds > 0 && `${d.signals.refunds} refund${d.signals.refunds === 1 ? "" : "s"}`,
    d.signals.voids > 0 && `${d.signals.voids} cancelled sale${d.signals.voids === 1 ? "" : "s"}`,
    d.signals.adjustments > 0 && `${d.signals.adjustments} stock write-off${d.signals.adjustments === 1 ? "" : "s"} (${formatMoney(d.signals.write_off_value)})`,
    d.signals.over_limit > 0 && `${d.signals.over_limit} credit sale${d.signals.over_limit === 1 ? "" : "s"} over limit`,
    d.signals.held > 0 && `${d.signals.held} sale${d.signals.held === 1 ? "" : "s"} waiting for approval`,
  ].filter(Boolean) as string[];

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand">Today</h1>
          <p className="text-muted">{formatDate(today)}</p>
        </div>
        <Link href="/owner/summary" className="flex h-11 items-center gap-2 rounded-control border border-input bg-card px-3 text-sm font-semibold">
          <Share2 aria-hidden="true" className="size-4" /> End of day
        </Link>
      </div>

      <div className="rounded-card border border-line bg-card p-4">
        <p className="text-muted">Sales today</p>
        <p className="text-4xl font-extrabold text-ink">{formatMoney(d.sales_total)}</p>
        <p className="text-sm text-muted">
          {d.sales_count} sales
          {change !== null && (
            <span className={change >= 0 ? "text-brand" : "text-danger"}>
              {" "}
              · {change >= 0 ? "▲" : "▼"} {Math.abs(change)}% vs yesterday
            </span>
          )}
        </p>
        <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3 text-sm">
          <Split label="Cash" value={d.cash} />
          <Split label="MoMo" value={d.momo} />
          <Split label="Credit" value={d.credit} />
        </dl>
        <p className="mt-3 border-t border-line pt-3">
          Profit today <strong className="text-lg text-brand">{formatMoney(d.profit)}</strong>
          {d.lines_without_cost > 0 && <span className="block text-sm text-warning">Some items sold have no cost price, so profit looks higher than it is.</span>}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Alert href="/owner/approvals" icon={ClipboardCheck} tone={waiting > 0 ? "accent" : "ok"} title={waiting > 0 ? `${waiting} waiting for you` : "Nothing waiting"} note={waiting > 0 ? [d.pending.requests && `${d.pending.requests} requests`, d.pending.deliveries && `${d.pending.deliveries} deliveries`, d.pending.cash_ups && `${d.pending.cash_ups} cash-ups`, d.pending.expenses && `${d.pending.expenses} expenses`].filter(Boolean).join(", ") : "Approvals"} />
        <Alert href="/owner/stock/missing" icon={SearchX} tone={(m?.missing_value ?? 0) > 0 ? "danger" : "ok"} title={`${formatMoney(m?.missing_value ?? 0)} missing stock`} note="Last 30 days, from stock counts" />
        <Alert href="/owner/stock" icon={PackageX} tone={d.low_stock > 0 ? "accent" : "ok"} title={`${d.low_stock} low stock`} note="Products to reorder" />
        <Alert href="/owner/money/cash-ups" icon={Wallet} tone={(m?.shortages ?? 0) > 0 ? "danger" : "ok"} title={`${formatMoney(m?.shortages ?? 0)} cash short`} note="Last 30 days" />
      </div>

      {signals.length > 0 && (
        <div className="space-y-2 rounded-card border border-warning/30 bg-warning-bg p-4">
          <p className="flex items-center gap-2 font-bold text-warning">
            <AlertTriangle aria-hidden="true" className="size-5" /> Check these today
          </p>
          <ul className="list-disc space-y-1 pl-6 text-warning">
            {signals.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-2">
        <h2 className="text-lg font-bold">Sales by attendant</h2>
        {d.per_attendant.length === 0 ? (
          <p className="rounded-card border border-dashed border-input bg-card p-4 text-muted">No sales yet today.</p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-card">
            {d.per_attendant.map((a) => {
              const low = a.avg_daily_before && a.total < a.avg_daily_before * 0.5;
              return (
                <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span>
                    <span className="block font-semibold">{a.name}</span>
                    <span className="block text-sm text-muted">
                      {a.count} sales
                      {a.avg_daily_before ? ` · usually ${formatMoney(a.avg_daily_before)} a day` : ""}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block font-bold">{formatMoney(a.total)}</span>
                    {low && <span className="text-xs font-semibold text-warning">Below usual so far</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Link href="/owner/money/owed" className="flex min-h-16 items-center gap-3 rounded-card border border-line bg-card px-4 py-3">
        <HandCoins aria-hidden="true" className="size-6 text-brand" />
        <span className="flex-1">
          <span className="block font-semibold">Money owed: {formatMoney(d.money_owed)}</span>
          <span className="block text-sm text-muted">{d.debtors} customers</span>
        </span>
        <ChevronRight aria-hidden="true" className="size-5 text-muted" />
      </Link>
    </section>
  );
}

function Split({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="font-bold">{formatMoney(value)}</dd>
    </div>
  );
}

function Alert({
  href,
  icon: Icon,
  tone,
  title,
  note,
}: {
  href: string;
  icon: typeof ClipboardCheck;
  tone: "ok" | "accent" | "danger";
  title: string;
  note: string;
}) {
  const styles = {
    ok: "border-line bg-card",
    accent: "border-accent bg-warning-bg",
    danger: "border-danger/40 bg-danger/5",
  };
  const iconStyles = { ok: "text-brand", accent: "text-warning", danger: "text-danger" };
  return (
    <Link href={href} className={`flex min-h-16 items-center gap-3 rounded-card border px-4 py-3 ${styles[tone]}`}>
      {tone === "ok" ? <CheckCircle2 aria-hidden="true" className="size-6 text-brand" /> : <Icon aria-hidden="true" className={`size-6 ${iconStyles[tone]}`} />}
      <span className="min-w-0 flex-1">
        <span className="block font-bold">{title}</span>
        <span className="block truncate text-sm text-muted">{note}</span>
      </span>
      <ChevronRight aria-hidden="true" className="size-5 text-muted" />
    </Link>
  );
}
