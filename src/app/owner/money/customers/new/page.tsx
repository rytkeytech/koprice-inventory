import type { Metadata } from "next";
import { BackLink } from "@/components/BackLink";
import { CustomerForm } from "@/components/CustomerForm";

export const metadata: Metadata = { title: "Add customer" };

export default function NewCustomerPage() {
  return (
    <section className="mx-auto max-w-xl space-y-4">
      <BackLink href="/owner/money/customers">Customers</BackLink>
      <h1 className="text-2xl font-bold text-brand">Add customer</h1>
      <div className="rounded-card border border-line bg-card p-4">
        <CustomerForm />
      </div>
    </section>
  );
}
