import type { Metadata } from "next";
import { BackLink } from "@/components/BackLink";
import { getCategories } from "@/lib/catalogue";
import { ProductForm } from "../ProductForm";

export const metadata: Metadata = { title: "Add product" };

export default async function NewProductPage() {
  const categories = await getCategories();
  return (
    <section className="mx-auto max-w-2xl space-y-4">
      <BackLink href="/owner/stock">Stock</BackLink>
      <h1 className="text-2xl font-bold text-brand">Add product</h1>
      <ProductForm categories={categories} />
    </section>
  );
}
