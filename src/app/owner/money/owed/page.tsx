import type { Metadata } from "next";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { BackLink } from "@/components/BackLink";
import { getShopSettings } from "@/lib/catalogue";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { reminderText, whatsappLink, whatsappNumber } from "@/lib/receipt";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Money owed" };

export default async function OwedPage() {
  const supabase = await createClient();
  const [{ data, error }, shop] = await Promise.all([supabase.rpc("debtors"), getShopSettings()]);
  const debtors = data ?? [];
  const total = debtors.reduce((sum, d) => sum + Number(d.balance), 0);

  return (
    <section className="space-y-4">
      <BackLink href="/owner/money">Money</BackLink>
      <div>
        <h1 className="text-2xl font-bold text-brand">Money owed</h1>
        <p className="text-muted">
          {debtors.length} customers owe <strong className="text-ink">{formatMoney(total)}</strong>
        </p>
      </div>

      {error && <p className="rounded-control bg-danger/10 p-3 text-danger">Could not load. Please reload.</p>}
      {debtors.length === 0 && !error && (
        <p className="rounded-card border border-dashed border-input bg-card p-6 text-center text-muted">Nobody owes the shop money.</p>
      )}

      <ul className="grid gap-3 md:grid-cols-2">
        {debtors.map((d) => {
          const days = d.days_owed ?? 0;
          const overLimit = Number(d.balance) > Number(d.credit_limit);
          return (
            <li key={d.id} className="space-y-3 rounded-card border border-line bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/owner/money/customers/${d.id}`} className="block truncate font-bold text-brand underline-offset-4 hover:underline">
                    {d.name}
                  </Link>
                  <p className="text-sm text-muted">
                    {d.phone ?? "No phone"} · {d.type}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-extrabold">{formatMoney(d.balance)}</p>
                  <p className="text-sm text-muted">Limit {formatMoney(d.credit_limit)}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-sm">
                <span className={`rounded-full px-2.5 py-1 font-semibold ${days > 30 ? "bg-danger/10 text-danger" : days > 7 ? "bg-warning-bg text-warning" : "bg-bg text-muted"}`}>
                  {d.oldest_unpaid_at ? `Owing ${days} day${days === 1 ? "" : "s"}` : "Owing"}
                </span>
                {overLimit && <span className="rounded-full bg-danger/10 px-2.5 py-1 font-semibold text-danger">Over limit</span>}
                <span className="rounded-full bg-bg px-2.5 py-1 text-muted">
                  Last paid {d.last_payment_at ? formatDate(d.last_payment_at) : "never"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {whatsappNumber(d.phone) ? (
                  <a
                    href={whatsappLink(reminderText(d.name, d.balance, shop), d.phone)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-12 items-center justify-center gap-2 rounded-control border border-input font-semibold"
                  >
                    <MessageCircle aria-hidden="true" className="size-4" /> Remind
                  </a>
                ) : (
                  <span className="flex h-12 items-center justify-center rounded-control bg-bg text-sm text-muted">No WhatsApp number</span>
                )}
                <Link href={`/owner/money/customers/${d.id}#pay`} className="flex h-12 items-center justify-center rounded-control bg-brand font-semibold text-white">
                  Record payment
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
