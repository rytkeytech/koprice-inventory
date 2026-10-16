import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/BackLink";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { ConfirmCashUpForm } from "./ConfirmCashUpForm";

export const metadata: Metadata = { title: "Cash-up" };

type Totals = {
  sales_count: number;
  sales_total: number;
  cash_sales: number;
  momo_sales: number;
  credit_given: number;
  discounts: number;
  repaid_cash: number;
  repaid_momo: number;
  held_count: number;
  void_count: number;
};

export default async function CashUpPage({ params }: PageProps<"/owner/money/cash-ups/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: c } = await supabase
    .from("cash_ups")
    .select("*, attendant:profiles!cash_ups_attendant_id_fkey(full_name), checker:profiles!cash_ups_confirmed_by_fkey(full_name)")
    .eq("id", id)
    .maybeSingle();
  if (!c) notFound();
  const { data: totals } = await supabase.rpc("attendant_day", { p_attendant: c.attendant_id, p_date: c.business_date });
  const t = (totals ?? {}) as unknown as Totals;

  const facts: [string, string][] = [
    [`Sales (${t.sales_count ?? 0})`, formatMoney(t.sales_total ?? 0)],
    ["Cash from sales", formatMoney(t.cash_sales ?? 0)],
    ["Credit paid back in cash", formatMoney(t.repaid_cash ?? 0)],
    ["MoMo (sales + repayments)", formatMoney(Number(t.momo_sales ?? 0) + Number(t.repaid_momo ?? 0))],
    ["Credit given", formatMoney(t.credit_given ?? 0)],
    ["Discounts", formatMoney(t.discounts ?? 0)],
  ];

  return (
    <section className="mx-auto max-w-xl space-y-4">
      <BackLink href="/owner/money/cash-ups">Cash-ups</BackLink>
      <div>
        <h1 className="text-2xl font-bold text-brand">{c.attendant?.full_name ?? "?"}</h1>
        <p className="text-muted">
          {formatDate(c.business_date)} · closed {formatDateTime(c.created_at)}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-card border border-line bg-card p-4">
          <p className="text-sm text-muted">Expected cash</p>
          <p className="text-2xl font-extrabold">{formatMoney(c.expected_cash)}</p>
        </div>
        <div className="rounded-card border border-line bg-card p-4">
          <p className="text-sm text-muted">Handed over ({c.handover_method === "momo" ? "MoMo" : "safe"})</p>
          <p className="text-2xl font-extrabold">{formatMoney(c.amount_handed)}</p>
          {c.momo_txn_id && <p className="text-sm text-muted">ID {c.momo_txn_id}</p>}
        </div>
      </div>

      <dl className="divide-y divide-line rounded-card border border-line bg-card px-4 text-sm">
        {facts.map(([label, value]) => (
          <div key={label} className="flex justify-between py-2.5">
            <dt className="text-muted">{label}</dt>
            <dd className="font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      {(t.held_count > 0 || t.void_count > 0) && (
        <p className="rounded-control bg-warning-bg p-3 text-sm text-warning">
          Not counted: {t.held_count} sale(s) waiting for approval, {t.void_count} cancelled sale(s).
        </p>
      )}
      {c.note && <p className="rounded-control bg-bg p-3 whitespace-pre-line">{c.note}</p>}

      {c.status === "submitted" ? (
        <ConfirmCashUpForm id={c.id} expectedCash={Number(c.expected_cash)} amountHanded={Number(c.amount_handed)} />
      ) : (
        <p className={`rounded-control p-4 text-lg font-bold ${c.status === "short" ? "bg-danger/10 text-danger" : "bg-success-bg text-brand"}`}>
          {c.status === "short" ? `Short by ${formatMoney(c.shortage ?? 0)}` : "Confirmed"} · counted {formatMoney(c.confirmed_amount ?? 0)} by {c.checker?.full_name ?? "?"}
        </p>
      )}
    </section>
  );
}
