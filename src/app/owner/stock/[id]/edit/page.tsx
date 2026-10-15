import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/BackLink";
import { getCategories, getCosts, getProduct } from "@/lib/catalogue";
import { ProductForm } from "../../ProductForm";

export const metadata: Metadata = { title: "Edit product" };

export default async function EditProductPage({ params }: PageProps<"/owner/stock/[id]/edit">) {
  const { id } = await params;
  const [product, categories, costs] = await Promise.all([getProduct(id), getCategories(), getCosts()]);
  if (!product) notFound();

  return (
    <section className="mx-auto max-w-2xl space-y-4">
      <BackLink href={`/owner/stock/${id}`}>{product.name}</BackLink>
      <h1 className="text-2xl font-bold text-brand">Edit product</h1>
      <ProductForm product={product} categories={categories} costPerUnit={costs.get(id) ?? null} />
    </section>
  );
}
