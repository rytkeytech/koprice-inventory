import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/BackLink";
import { formatDateTime } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { DeliveryReview, type DeliveryItem } from "./DeliveryReview";

export const metadata: Metadata = { title: "Check delivery" };

type Details = {
  id: string;
  created_at: string;
  status: string;
  note: string | null;
  invoice_photo: string | null;
  supplier: string | null;
  received_by_name: string | null;
  checked_by_name: string | null;
  checked_at: string | null;
  items: DeliveryItem[];
};

export default async function DeliveryPage({ params }: PageProps<"/owner/approvals/deliveries/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("delivery_details", { p_delivery_id: id });
  if (error || !data) notFound();
  const d = data as unknown as Details;

  // Invoice photos are private: make a link that works for one hour.
  const photo = d.invoice_photo
    ? (await supabase.storage.from("invoices").createSignedUrl(d.invoice_photo, 3600)).data?.signedUrl
    : null;

  return (
    <section className="mx-auto max-w-2xl space-y-4">
      <BackLink href="/owner/approvals">Approvals</BackLink>
      <div>
        <h1 className="text-2xl font-bold text-brand">Delivery from {d.supplier ?? "unknown supplier"}</h1>
        <p className="text-muted">
          Received by {d.received_by_name ?? "?"} · {formatDateTime(d.created_at)}
        </p>
        {d.status !== "pending_check" && (
          <p className={`font-semibold ${d.status === "queried" ? "text-danger" : "text-brand"}`}>
            {d.status === "queried" ? "Queried" : "Confirmed"} by {d.checked_by_name} · {formatDateTime(d.checked_at)}
          </p>
        )}
        {d.note && <p className="mt-2 rounded-control bg-bg p-3 whitespace-pre-line">{d.note}</p>}
      </div>

      {photo ? (
        <a href={photo} target="_blank" rel="noopener noreferrer" className="block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo} alt="Invoice photo" className="max-h-96 w-full rounded-card border border-line bg-card object-contain" />
        </a>
      ) : (
        <p className="rounded-card border border-dashed border-input bg-card p-4 text-muted">No invoice photo.</p>
      )}

      <DeliveryReview deliveryId={d.id} items={d.items} status={d.status} />
    </section>
  );
}
