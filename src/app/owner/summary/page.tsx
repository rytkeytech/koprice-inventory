import type { Metadata } from "next";
import { MessageCircle } from "lucide-react";
import { BackLink } from "@/components/BackLink";
import { getShopSettings } from "@/lib/catalogue";
import { accraDateDaysAgo, formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { whatsappLink } from "@/lib/receipt";
import type { Dashboard } from "@/lib/report-types";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "End of day" };

export default async function SummaryPage() {
  const supabase = await createClient();
  const today = accraDateDaysAgo(0);
  const [{ data }, shop, { data: cashUps }] = await Promise.all([
    supabase.rpc("owner_dashboard", { p_from: today, p_to: today }),
    getShopSettings(),
    supabase
      .from("cash_ups")
      .select("status, expected_cash, amount_handed, profiles!cash_ups_attendant_id_fkey(full_name)")
      .eq("business_date", today),
  ]);
  if (!data) return <p className="rounded-control bg-danger/10 p-3 text-danger">Could not load today&apos;s figures.</p>;
  const d = data as unknown as Dashboard;

  const lines = [
    `*${shop.shop_name} – ${formatDate(today)}*`,
    `Sales: ${formatMoney(d.sales_total)} (${d.sales_count} sales)`,
    `Cash ${formatMoney(d.cash)} · MoMo ${formatMoney(d.momo)} · Credit ${formatMoney(d.credit)}`,
    `Profit: ${formatMoney(d.profit)}`,
    d.repaid > 0 ? `Credit paid back: ${formatMoney(d.repaid)}` : "",
    "",
    "*By attendant*",
    ...(d.per_attendant.length ? d.per_attendant.map((a) => `- ${a.name}: ${formatMoney(a.total)} (${a.count})`) : ["- No sales"]),
    "",
    "*Cash-ups*",
    ...(cashUps?.length
      ? cashUps.map((c) => `- ${c.profiles?.full_name ?? "?"}: expected ${formatMoney(c.expected_cash)}, handed ${formatMoney(c.amount_handed)} (${c.status})`)
      : ["- None yet"]),
    "",
    d.signals.discounts || d.signals.refunds || d.signals.voids || d.signals.adjustments
      ? `Check: ${d.signals.discounts} discounts, ${d.signals.refunds} refunds, ${d.signals.voids} cancelled, ${d.signals.adjustments} write-offs`
      : "No discounts, refunds or write-offs today.",
    `Money owed: ${formatMoney(d.money_owed)} · Low stock: ${d.low_stock} products`,
  ].filter((l, i, all) => l !== "" || all[i - 1] !== "");
  const text = lines.join("\n");

  return (
    <section className="mx-auto max-w-xl space-y-4">
      <BackLink href="/owner">Home</BackLink>
      <h1 className="text-2xl font-bold text-brand">End of day summary</h1>
      <pre className="rounded-card border border-line bg-card p-4 font-sans text-sm whitespace-pre-wrap">{text.replace(/\*/g, "")}</pre>
      <a href={whatsappLink(text)} target="_blank" rel="noopener noreferrer" className="flex h-14 items-center justify-center gap-2 rounded-control bg-[#1f7a3a] text-lg font-bold text-white">
        <MessageCircle aria-hidden="true" className="size-5" /> Share to WhatsApp
      </a>
    </section>
  );
}
