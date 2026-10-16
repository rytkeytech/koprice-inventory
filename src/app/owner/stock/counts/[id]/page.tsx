import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/BackLink";
import { CountSheet, type CountItem } from "@/components/CountSheet";
import { formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { FinishCount } from "./FinishCount";

export const metadata: Metadata = { title: "Stock count" };

type Sheet = {
  type: string;
  status: string;
  note: string | null;
  created_at: string;
  completed_at: string | null;
  corrections_applied: boolean;
  items: CountItem[];
};

export default async function OwnerCountPage({ params }: PageProps<"/owner/stock/counts/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("count_sheet", { p_count_id: id });
  if (error || !data) notFound();
  const sheet = data as unknown as Sheet;

  const counted = sheet.items.filter((i) => i.counted_units !== null);
  const missing = -counted.reduce((sum, i) => sum + Math.min(0, Number(i.difference_cost ?? 0)), 0);
  const extra = counted.reduce((sum, i) => sum + Math.max(0, Number(i.difference_cost ?? 0)), 0);
  const short = counted.filter((i) => (i.difference_units ?? 0) < 0).length;

  return (
    <section className="mx-auto max-w-2xl space-y-4">
      <BackLink href="/owner/stock/counts">Stock counts</BackLink>
      <div>
        <h1 className="text-2xl font-bold text-brand">{sheet.type === "full" ? "Full count" : "Spot count"}</h1>
        <p className="text-muted">
          Started {formatDateTime(sheet.created_at)}
          {sheet.completed_at && ` · finished ${formatDateTime(sheet.completed_at)}`}
          {sheet.note && ` · ${sheet.note}`}
        </p>
        {sheet.status === "completed" && (
          <p className="font-semibold text-brand">{sheet.corrections_applied ? "Stock was corrected to the count." : "Recorded only; stock was not changed."}</p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Missing at cost" value={formatMoney(missing)} danger={missing > 0} />
        <Stat label="Items short" value={String(short)} danger={short > 0} />
        <Stat label="Extra found" value={formatMoney(extra)} />
      </div>

      {sheet.status === "open" && <FinishCount countId={id} uncounted={sheet.items.length - counted.length} />}

      <CountSheet countId={id} items={sheet.items} open={sheet.status === "open"} showExpected />
    </section>
  );
}

function Stat({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="rounded-card border border-line bg-card p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className={`text-lg font-extrabold ${danger ? "text-danger" : "text-ink"}`}>{value}</p>
    </div>
  );
}
