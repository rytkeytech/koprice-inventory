import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, HandCoins, Receipt, UsersRound, Wallet, type LucideIcon } from "lucide-react";
import { formatMoney } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Money" };

export default async function MoneyPage() {
  const supabase = await createClient();
  const [debtors, cashUps, expenses] = await Promise.all([
    supabase.rpc("debtors"),
    supabase.from("cash_ups").select("id", { count: "exact", head: true }).eq("status", "submitted"),
    supabase.from("expenses").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);
  const owed = (debtors.data ?? []).reduce((sum, d) => sum + Number(d.balance), 0);
  const overdue = (debtors.data ?? []).filter((d) => (d.days_owed ?? 0) > 30).length;

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold text-brand">Money</h1>

      <div className="rounded-card border border-line bg-card p-4">
        <p className="text-muted">Money owed to the shop</p>
        <p className="text-3xl font-extrabold text-ink">{formatMoney(owed)}</p>
        <p className="text-sm text-muted">
          {debtors.data?.length ?? 0} customers
          {overdue > 0 && <span className="font-semibold text-danger"> · {overdue} owing over 30 days</span>}
        </p>
      </div>

      <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-card">
        <Item href="/owner/money/owed" icon={HandCoins} label="Money owed" note="Who owes, for how long, send reminders" />
        <Item href="/owner/money/customers" icon={UsersRound} label="Customers" note="Credit limits and statements" />
        <Item href="/owner/money/cash-ups" icon={Wallet} label="Cash-ups" note="Daily cash from attendants and shortages" badge={cashUps.count ?? 0} />
        <Item href="/owner/money/expenses" icon={Receipt} label="Expenses" note="Rent, electricity, transport, salaries" badge={expenses.count ?? 0} />
      </ul>
    </section>
  );
}

function Item({ href, icon: Icon, label, note, badge }: { href: string; icon: LucideIcon; label: string; note: string; badge?: number }) {
  return (
    <li>
      <Link href={href} className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-bg">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-success-bg text-brand">
          <Icon aria-hidden="true" className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{label}</span>
          <span className="block text-sm text-muted">{note}</span>
        </span>
        {badge ? (
          <span className="rounded-full bg-accent px-2.5 py-0.5 text-sm font-bold text-ink" aria-label={`${badge} waiting`}>
            {badge}
          </span>
        ) : null}
        <ChevronRight aria-hidden="true" className="size-5 text-muted" />
      </Link>
    </li>
  );
}
