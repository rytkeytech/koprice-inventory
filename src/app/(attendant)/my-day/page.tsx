import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, ClipboardList, HandCoins, MessageSquareWarning } from "lucide-react";
import { SALE_STATUS } from "@/components/SaleSummary";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { CloseDayForm } from "./CloseDayForm";

export const metadata: Metadata = { title: "My day" };

type Day = {
  business_date: string;
  sales_count: number;
  sales_total: number;
  cash_sales: number;
  momo_sales: number;
  credit_given: number;
  discounts: number;
  held_count: number;
  repaid_cash: number;
  repaid_momo: number;
  expected_cash: number;
  expected_momo: number;
  cash_up: {
    status: "submitted" | "confirmed" | "short";
    amount_handed: number;
    handover_method: string;
    confirmed_amount: number | null;
    shortage: number | null;
    note: string | null;
  } | null;
  sales: { id: string; receipt_no: string; created_at: string; total: number; status: string; customer: string | null }[];
};

export default async function MyDayPage() {
  const supabase = await createClient();
  const [{ data, error }, { data: openCounts }] = await Promise.all([
    supabase.rpc("my_day", {}),
    supabase.from("stock_counts").select("id").eq("status", "open"),
  ]);
  if (error || !data) {
    return <p className="rounded-control bg-danger/10 p-3 text-danger">Could not load your day. Please reload.</p>;
  }
  const day = data as unknown as Day;

  const rows = [
    { label: `My sales (${day.sales_count})`, value: day.sales_total },
    { label: "Cash from sales", value: day.cash_sales },
    { label: "MoMo received", value: day.momo_sales + day.repaid_momo },
    { label: "Credit given", value: day.credit_given },
    { label: "Credit paid back in cash", value: day.repaid_cash },
  ];

  return (
    <section className="mx-auto max-w-xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-brand">My day</h1>
        <p className="text-muted">{formatDate(day.business_date)}</p>
      </div>

      {openCounts && openCounts.length > 0 && (
        <Link href={openCounts.length === 1 ? `/count/${openCounts[0].id}` : "/count"} className="flex min-h-14 items-center gap-3 rounded-card bg-warning-bg px-4 py-3 font-semibold text-warning">
          <ClipboardList aria-hidden="true" className="size-5" /> A stock count is open. Tap to help count.
        </Link>
      )}

      <div className="rounded-card border border-line bg-card p-4">
        <dl className="divide-y divide-line">
          {rows.map((row) => (
            <div key={row.label} className="flex justify-between py-3">
              <dt className="text-muted">{row.label}</dt>
              <dd className="font-semibold">{formatMoney(row.value)}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-2 rounded-control bg-success-bg p-4">
          <p className="text-sm font-semibold text-muted">Cash to hand over</p>
          <p className="text-3xl font-extrabold text-brand">{formatMoney(day.expected_cash)}</p>
        </div>
      </div>

      {day.cash_up ? (
        <div
          className={`rounded-card p-4 ${
            day.cash_up.status === "short" ? "bg-danger/10 text-danger" : day.cash_up.status === "confirmed" ? "bg-success-bg text-brand" : "bg-info-bg text-info"
          }`}
        >
          <p className="text-lg font-bold">
            {day.cash_up.status === "submitted" && "Day closed. Waiting for the owner to check."}
            {day.cash_up.status === "confirmed" && "Day closed and confirmed by the owner."}
            {day.cash_up.status === "short" && `The owner recorded a shortage of ${formatMoney(day.cash_up.shortage ?? 0)}.`}
          </p>
          <p>
            You handed over {formatMoney(day.cash_up.amount_handed)} ({day.cash_up.handover_method === "momo" ? "MoMo" : "shop safe"}).
          </p>
          {day.cash_up.note && <p className="mt-1 whitespace-pre-line text-sm">{day.cash_up.note}</p>}
        </div>
      ) : (
        <CloseDayForm businessDate={day.business_date} expectedCash={Number(day.expected_cash)} heldCount={day.held_count} />
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <Link href="/repayment" className="flex min-h-14 items-center gap-3 rounded-card border border-line bg-card px-4 font-semibold">
          <HandCoins aria-hidden="true" className="size-5 text-brand" /> Customer paying back credit
        </Link>
        <Link href="/requests" className="flex min-h-14 items-center gap-3 rounded-card border border-line bg-card px-4 font-semibold">
          <MessageSquareWarning aria-hidden="true" className="size-5 text-brand" /> Ask the owner
        </Link>
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-bold">My sales today</h2>
        {day.sales.length === 0 ? (
          <p className="rounded-card border border-dashed border-input bg-card p-4 text-muted">No sales yet today.</p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-card">
            {day.sales.map((s) => {
              const status = SALE_STATUS[s.status] ?? SALE_STATUS.completed;
              return (
                <li key={s.id}>
                  <Link href={`/my-sales/${s.id}`} className="flex min-h-14 items-center gap-3 px-4 py-2 hover:bg-bg">
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">
                        {s.receipt_no} · {formatMoney(s.total)}
                      </span>
                      <span className="block text-sm text-muted">
                        {formatDateTime(s.created_at)}
                        {s.customer && ` · ${s.customer}`}
                      </span>
                    </span>
                    {s.status !== "completed" && <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${status.className}`}>{status.label}</span>}
                    <ChevronRight aria-hidden="true" className="size-5 text-muted" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
