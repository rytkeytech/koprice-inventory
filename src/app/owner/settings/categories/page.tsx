import type { Metadata } from "next";
import { BackLink } from "@/components/BackLink";
import { getCategories } from "@/lib/catalogue";
import { CategoryManager } from "./CategoryManager";

export const metadata: Metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const categories = await getCategories();
  return (
    <section className="mx-auto max-w-2xl space-y-4">
      <BackLink href="/owner/settings">Settings</BackLink>
      <h1 className="text-2xl font-bold text-brand">Categories</h1>
      <p className="text-muted">
        Groups for the Stock list and Sell screen. Hidden categories stay on old products but aren&apos;t offered for new ones.
      </p>
      <CategoryManager categories={categories} />
    </section>
  );
}
