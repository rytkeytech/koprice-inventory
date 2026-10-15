import type { Metadata } from "next";
import { BackLink } from "@/components/BackLink";
import { RecordPaymentForm } from "@/components/RecordPaymentForm";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Credit repayment" };

// Attendant records a customer paying back credit. Cash taken here is
// added to the attendant's "cash to hand over" for the day.
export default async function RepaymentPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("customers")
    .select("id, name, phone, balance")
    .gt("balance", 0)
    .eq("is_active", true)
    .order("name");

  return (
    <section className="mx-auto max-w-xl space-y-4">
      <BackLink href="/my-day">My day</BackLink>
      <h1 className="text-2xl font-bold text-brand">Customer paying back credit</h1>
      <div className="rounded-card border border-line bg-card p-4">
        <RecordPaymentForm customers={(data ?? []).map((c) => ({ ...c, balance: Number(c.balance) }))} />
      </div>
    </section>
  );
}
