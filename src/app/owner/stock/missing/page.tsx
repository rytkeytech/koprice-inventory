import type { Metadata } from "next";
import { MessageCircle } from "lucide-react";
import { BackLink } from "@/components/BackLink";
import { getShopSettings } from "@/lib/catalogue";
import { accraDateDaysAgo, formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { whatsappLink } from "@/lib/receipt";
import { createClient } from "@/lib/supabase/server";
import { plural } from "@/lib/stock";

export const metadata: Metadata = { title: "Missing stock" };

type Report = {
  from: string;
  to: string;
  counts: number;
  missing_value: number;
  extra_value: number;
  items: { name: string; base_unit: string; expected: number; counted: number; difference: number; value: number; cost_missing: boolean }[];
  write_offs: Record<string, number>;
  on_duty: { name: string; days: number; sales: number }[];
};

const RANGES = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
];

const WRITE_OFF_LABELS: Record<string, string> = {
  adjust_damaged: "Damaged",
  adjust_expired: "Expired",
  adjust_stolen: "Missing / stolen",
};

export default async function MissingStockPage({ searchParams }: PageProps<"/owner/stock/missing">) {
  const params = await searchParams;
  const days = RANGES.some((r) => String(r.days) === params.days) ? Number(params.days) : 30;
  const supabase = await createClient();
  const today = accraDateDaysAgo(0);
  const from = accraDateDaysAgo(days - 1);
  const [{ data, error }, shop] = await Promise.all([
    supabase.rpc("missing_stock_report", { p_from: from, p_to: today }),
    getShopSettings(),
  ]);
  if (error || !data) return <p className="rounded-control bg-danger/10 p-3 text-danger">Could not load the report.</p>;
  const r = data as unknown as Report;
  const writeOffTotal = Object.values(r.write_offs).reduce((a, b) => a + Number(b), 0);

  const shareText = [
    `*${shop.shop_name} – Missing stock*`,
    `${formatDate(r.from)} to ${formatDate(r.to)}`,
    `Missing at cost: ${formatMoney(r.missing_value)} (${r.counts} counts)`,
    ...r.items.slice(0, 10).map((i) => `- ${i.name}: ${i.difference} ${plural(i.base_unit, Math.abs(i.difference))} (${formatMoney(i.value)})`),
    writeOffTotal > 0 ? `Written off (damaged/expired/stolen): ${formatMoney(writeOffTotal)}` : "",
    r.on_duty.length ? `On duty: ${r.on_duty.map((d) => `${d.name.split(" ")[0]} (${d.days} days)`).join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <section className="space-y-4">
      <BackLink href="/owner/stock">Stock</BackLink>
      <div>
        <h1 className="text-2xl font-bold text-brand">Missing stock</h1>
        <p className="text-muted">
          From completed stock counts, valued at cost price. {formatDate(r.from)} – {formatDate(r.to)}
        </p>
      </div>

      <nav aria-label="Period" className="flex gap-2">
        {RANGES.map((range) => (
          <a
            key={range.days}
            href={`?days=${range.days}`}
            aria-current={range.days === days ? "page" : undefined}
            className={`flex h-10 items-center rounded-full px-4 text-sm font-semibold ${range.days === days ? "bg-brand text-white" : "border border-input bg-card"}`}
          >
            {range.label}
          </a>
        ))}
      </nav>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-card border border-line bg-card p-4">
          <p className="text-sm text-muted">Missing (at cost)</p>
          <p className={`text-3xl font-extrabold ${r.missing_value > 0 ? "text-danger" : "text-brand"}`}>{formatMoney(r.missing_value)}</p>
          <p className="text-sm text-muted">{r.counts} stock counts finished</p>
        </div>
        <div className="rounded-card border border-line bg-card p-4">
          <p className="text-sm text-muted">Written off</p>
          <p className="text-2xl font-extrabold">{formatMoney(writeOffTotal)}</p>
          <p className="text-sm text-muted">
            {Object.entries(r.write_offs)
              .map(([k, v]) => `${WRITE_OFF_LABELS[k] ?? k} ${formatMoney(v)}`)
              .join(" · ") || "None"}
          </p>
        </div>
        <div className="rounded-card border border-line bg-card p-4">
          <p className="text-sm text-muted">Extra found</p>
          <p className="text-2xl font-extrabold">{formatMoney(r.extra_value)}</p>
        </div>
      </div>

      {r.items.length > 0 ? (
        <div className="overflow-x-auto rounded-card border border-line bg-card">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="bg-bg text-muted">
              <tr>
                <th className="px-3 py-2">Product</th>
                <th className="px-3 py-2 text-right">Expected</th>
                <th className="px-3 py-2 text-right">Counted</th>
                <th className="px-3 py-2 text-right">Short</th>
                <th className="px-3 py-2 text-right">Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {r.items.map((i) => (
                <tr key={i.name}>
                  <td className="px-3 py-2 font-semibold">{i.name}</td>
                  <td className="px-3 py-2 text-right">{i.expected}</td>
                  <td className="px-3 py-2 text-right">{i.counted}</td>
                  <td className="px-3 py-2 text-right font-semibold text-danger">{i.difference}</td>
                  <td className="px-3 py-2 text-right">{i.cost_missing ? "No cost" : formatMoney(i.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-card border border-dashed border-input bg-card p-6 text-center text-muted">
          {r.counts === 0 ? "No stock counts were finished in this period. Start a spot count on your next visit." : "Nothing was missing in these counts."}
        </p>
      )}

      {r.on_duty.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-lg font-bold">Attendants on duty in this period</h2>
          <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-card">
            {r.on_duty.map((d) => (
              <li key={d.name} className="flex justify-between px-4 py-3">
                <span className="font-semibold">{d.name}</span>
                <span className="text-muted">
                  {d.days} day{d.days === 1 ? "" : "s"} · sales {formatMoney(d.sales)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <a href={whatsappLink(shareText)} target="_blank" rel="noopener noreferrer" className="flex h-12 items-center justify-center gap-2 rounded-control border border-input bg-card font-semibold">
        <MessageCircle aria-hidden="true" className="size-5" /> Share report on WhatsApp
      </a>
    </section>
  );
}
