import type { Metadata } from "next";
import { BackLink } from "@/components/BackLink";
import { getCategories } from "@/lib/catalogue";
import { ImportClient } from "./ImportClient";

export const metadata: Metadata = { title: "Import from Excel" };

export default async function ImportPage() {
  const categories = await getCategories({ activeOnly: true });
  return (
    <section className="space-y-4">
      <BackLink href="/owner/stock">Stock</BackLink>
      <h1 className="text-2xl font-bold text-brand">Import from Excel</h1>
      <ImportClient categories={categories.map((c) => c.name)} />
    </section>
  );
}
