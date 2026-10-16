import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { BackLink } from "@/components/BackLink";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Cash-ups" };

const STATUS: Record<string, { label: string; className: string }> = {
  submitted: { label: "To check", className: "bg-warning-bg text-warning" },
  confirmed: { label: "OK", className: "bg-success-bg text-brand" },
  short: { label: "Short", className: "bg-danger/10 text-danger" },
};

export default async function CashUpsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("cash_ups")
    .select("id, business_date, expected_cash, amount_handed, confirmed_amount, shortage, status, handover_method, attendant_id, profiles!cash_ups_attendant_id_fkey(full_name)")
    .order("business_date", { ascending: false })
    .limit(120);
  const cashUps = data ?? [];

  // Shortages per attendant over the last 90 days (shown up to 120 cash-ups).
  const byAttendant = new Map<string, { name: string; count: number; short: number; days: number }>();
  for (const c of cashUps) {
    const entry = byAttendant.get(c.attendant_id) ?? { name: c.profiles?.full_name ?? "?", count: 0, short: 0, days: 0 };
    entry.days += 1;
    if (c.status === "short") {
      entry.count += 1;
      entry.short += Number(c.shortage ?? 0);
    }
    byAttendant.set(c.attendant_id, entry);
  }

  return (
    <section className="space-y-4">
      <BackLink href="/owner/money">Money</BackLink>
      <h1 className="text-2xl font-bold text-brand">Cash-ups</h1>

      {byAttendant.size > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[...byAttendant.values()].map((a) => (
            <div key={a.name} className="rounded-card border border-line bg-card p-4">
              <p className="font-bold">{a.name}</p>
              <p className="text-sm text-muted">{a.days} days closed</p>
              <p className={`mt-1 text-lg font-extrabold ${a.short > 0 ? "text-danger" : "text-brand"}`}>
                {a.short > 0 ? `${formatMoney(a.short)} short (${a.count} day${a.count === 1 ? "" : "s"})` : "No shortages"}
              </p>
            </div>
          ))}
        </div>
      )}

      {cashUps.length === 0 ? (
        <p className="rounded-card border border-dashed border-input bg-card p-6 text-center text-muted">No cash-ups yet.</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-card">
          {cashUps.map((c) => {
            const s = STATUS[c.status];
            return (
              <li key={c.id}>
                <Link href={`/owner/money/cash-ups/${c.id}`} className="flex min-h-16 items-center gap-3 px-4 py-2 hover:bg-bg">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">
                      {c.profiles?.full_name ?? "?"} · {formatDate(c.business_date)}
                    </span>
                    <span className="block text-sm text-muted">
                      Expected {formatMoney(c.expected_cash)} · handed {formatMoney(c.amount_handed)}
                      {c.confirmed_amount != null && ` · counted ${formatMoney(c.confirmed_amount)}`}
                    </span>
                  </span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${s.className}`}>
                    {s.label}
                    {c.status === "short" && ` ${formatMoney(c.shortage ?? 0)}`}
                  </span>
                  <ChevronRight aria-hidden="true" className="size-5 text-muted" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
