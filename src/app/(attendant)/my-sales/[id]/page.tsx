import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { AttendantSaleRequest } from "@/components/ApprovalButtons";
import { BackLink } from "@/components/BackLink";
import { SaleSummary } from "@/components/SaleSummary";
import { getShopSettings } from "@/lib/catalogue";
import { receiptText, whatsappLink, type Receipt } from "@/lib/receipt";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "My sale" };

export default async function MySalePage({ params }: PageProps<"/my-sales/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data, error }, shop, { data: pending }] = await Promise.all([
    supabase.rpc("sale_receipt", { p_sale_id: id }),
    getShopSettings(),
    supabase.from("approval_requests").select("type, status, reason").filter("payload->>sale_id", "eq", id).order("created_at", { ascending: false }).limit(1),
  ]);
  if (error || !data) notFound();
  const receipt = data as unknown as Receipt;
  const request = pending?.[0];

  return (
    <section className="mx-auto max-w-xl space-y-4">
      <BackLink href="/my-day">My day</BackLink>
      <SaleSummary receipt={receipt} />

      <a
        href={whatsappLink(receiptText(receipt, shop), receipt.customer?.phone)}
        target="_blank"
        rel="noopener noreferrer"
        className="flex h-12 items-center justify-center gap-2 rounded-control border border-input bg-card font-semibold"
      >
        <MessageCircle aria-hidden="true" className="size-5" /> Send receipt on WhatsApp
      </a>

      {request && (
        <p className={`rounded-control p-3 ${request.status === "pending" ? "bg-warning-bg text-warning" : request.status === "approved" ? "bg-success-bg text-brand" : "bg-danger/10 text-danger"}`}>
          Your request was {request.status === "pending" ? "sent and is waiting for the owner" : request.status}
          {request.reason ? `: “${request.reason}”` : "."}
        </p>
      )}

      {receipt.status === "completed" && request?.status !== "pending" && <AttendantSaleRequest saleId={receipt.sale_id} />}
    </section>
  );
}
