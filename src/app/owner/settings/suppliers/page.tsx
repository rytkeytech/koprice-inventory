import type { Metadata } from "next";
import { BackLink } from "@/components/BackLink";
import { createClient } from "@/lib/supabase/server";
import { SupplierManager } from "./SupplierManager";

export const metadata: Metadata = { title: "Suppliers" };

export default async function SuppliersPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("suppliers").select("id, name, phone, notes, is_active").order("name");
  return (
    <section className="mx-auto max-w-2xl space-y-4">
      <BackLink href="/owner/settings">Settings</BackLink>
      <h1 className="text-2xl font-bold text-brand">Suppliers</h1>
      <SupplierManager suppliers={data ?? []} />
    </section>
  );
}
