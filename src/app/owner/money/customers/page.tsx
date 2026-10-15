import type { Metadata } from "next";
import { Plus } from "lucide-react";
import Link from "next/link";
import { BackLink } from "@/components/BackLink";
import { createClient } from "@/lib/supabase/server";
import { CustomerList } from "./CustomerList";

export const metadata: Metadata = { title: "Customers" };

export default async function CustomersPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("customers")
    .select("id, name, phone, type, balance, credit_limit, is_active")
    .order("name");

  return (
    <section className="space-y-4">
      <BackLink href="/owner/money">Money</BackLink>
      <div className="flex items-end justify-between gap-3">
        <h1 className="text-2xl font-bold text-brand">Customers</h1>
        <Link href="/owner/money/customers/new" className="flex h-12 items-center gap-2 rounded-control bg-brand px-4 font-semibold text-white">
          <Plus aria-hidden="true" className="size-5" /> Add customer
        </Link>
      </div>
      <CustomerList
        customers={(data ?? []).map((c) => ({ ...c, balance: Number(c.balance), credit_limit: Number(c.credit_limit) }))}
      />
    </section>
  );
}
