import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OwnerSaleActions } from "@/components/ApprovalButtons";
import { BackLink } from "@/components/BackLink";
import { SaleSummary } from "@/components/SaleSummary";
import { formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import type { Receipt } from "@/lib/receipt";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Sale" };

export default async function OwnerSalePage({ params }: PageProps<"/owner/sales/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data, error }, { data: sale }, { data: costs }] = await Promise.all([
    supabase.rpc("sale_receipt", { p_sale_id: id }),
    supabase.from("sales").select("reversed_at, reverse_reason, money_returned, credit_reversed").eq("id", id).maybeSingle(),
    supabase.from("sale_item_costs").select("cost_total").eq("sale_id", id),
  ]);
  if (error || !data) notFound();
  const receipt = data as unknown as Receipt;
  const cost = (costs ?? []).reduce((sum, c) => sum + Number(c.cost_total), 0);

  return (
    <section className="mx-auto max-w-2xl space-y-4">
      <BackLink href="/owner/reports">Reports</BackLink>
      <SaleSummary receipt={receipt} />

      {receipt.status === "completed" && (
        <p className="rounded-card border border-line bg-card p-4">
          Cost of goods {formatMoney(cost)} · Profit <strong>{formatMoney(Number(receipt.total) - cost)}</strong>
        </p>
      )}

      {sale?.reversed_at && (
        <p className="rounded-control bg-info-bg p-3 text-info">
          {receipt.status === "refunded" ? "Refunded" : "Cancelled"} {formatDateTime(sale.reversed_at)}: {sale.reverse_reason}
          {Number(sale.money_returned) > 0 && ` · ${formatMoney(sale.money_returned)} returned`}
          {Number(sale.credit_reversed) > 0 && ` · ${formatMoney(sale.credit_reversed)} credit reversed`}
        </p>
      )}

      {receipt.status === "completed" && <OwnerSaleActions saleId={receipt.sale_id} />}
    </section>
  );
}
