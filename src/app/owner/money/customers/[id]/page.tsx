import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { BackLink } from "@/components/BackLink";
import { CustomerForm } from "@/components/CustomerForm";
import { RecordPaymentForm } from "@/components/RecordPaymentForm";
import { getShopSettings } from "@/lib/catalogue";
import { formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { reminderText, whatsappLink, whatsappNumber } from "@/lib/receipt";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Customer" };

export default async function CustomerPage({ params }: PageProps<"/owner/money/customers/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: customer }, { data: statement }, shop] = await Promise.all([
    supabase.from("customers").select("*").eq("id", id).maybeSingle(),
    supabase.rpc("customer_statement", { p_customer_id: id }),
    getShopSettings(),
  ]);
  if (!customer) notFound();

  const balance = Number(customer.balance);
  const lines = [...(statement ?? [])].reverse();

  return (
    <section className="space-y-4">
      <BackLink href="/owner/money/customers">Customers</BackLink>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand">{customer.name}</h1>
          <p className="text-muted">
            {customer.phone ?? "No phone"} · {customer.type}
            {!customer.is_active && " · hidden"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted">Owes</p>
          <p className={`text-3xl font-extrabold ${balance > 0 ? "text-warning" : "text-ink"}`}>{formatMoney(balance)}</p>
          <p className="text-sm text-muted">Limit {formatMoney(customer.credit_limit)}</p>
        </div>
      </div>

      {balance > 0 && whatsappNumber(customer.phone) && (
        <a
          href={whatsappLink(reminderText(customer.name, balance, shop), customer.phone)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-12 items-center justify-center gap-2 rounded-control border border-input bg-card font-semibold"
        >
          <MessageCircle aria-hidden="true" className="size-5" /> Send WhatsApp reminder
        </a>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {balance > 0 && (
          <div id="pay" className="space-y-3 rounded-card border border-line bg-card p-4">
            <h2 className="text-lg font-bold">Record a payment</h2>
            <RecordPaymentForm customer={{ id: customer.id, name: customer.name, phone: customer.phone, balance }} />
          </div>
        )}
        <div className="space-y-3 rounded-card border border-line bg-card p-4">
          <h2 className="text-lg font-bold">Details and credit limit</h2>
          <CustomerForm
            customer={{
              id: customer.id,
              name: customer.name,
              phone: customer.phone ?? "",
              type: customer.type as "retail" | "wholesale",
              credit_limit: Number(customer.credit_limit),
              notes: customer.notes ?? "",
              is_active: customer.is_active,
            }}
          />
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-bold">Statement</h2>
        {lines.length === 0 ? (
          <p className="rounded-card border border-dashed border-input bg-card p-4 text-muted">No credit sales or payments yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-card border border-line bg-card">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="bg-bg text-muted">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">What</th>
                  <th className="px-3 py-2 text-right">Owes more</th>
                  <th className="px-3 py-2 text-right">Paid</th>
                  <th className="px-3 py-2 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {lines.map((l, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2 whitespace-nowrap text-muted">{formatDateTime(l.happened_at)}</td>
                    <td className="px-3 py-2">
                      {l.description}
                      {l.reference && <span className="block text-xs text-muted">{l.reference}</span>}
                    </td>
                    <td className="px-3 py-2 text-right">{Number(l.debit) > 0 ? formatMoney(l.debit) : ""}</td>
                    <td className="px-3 py-2 text-right text-brand">{Number(l.credit) > 0 ? formatMoney(l.credit) : ""}</td>
                    <td className="px-3 py-2 text-right font-semibold">{formatMoney(l.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
