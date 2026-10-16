import type { Metadata } from "next";
import { BackLink } from "@/components/BackLink";
import { getProducts, getShopSettings } from "@/lib/catalogue";
import { StartCountForm } from "./StartCountForm";

export const metadata: Metadata = { title: "Start a count" };

export default async function NewCountPage() {
  const [products, settings] = await Promise.all([getProducts({ activeOnly: true }), getShopSettings()]);
  return (
    <section className="mx-auto max-w-xl space-y-4">
      <BackLink href="/owner/stock/counts">Stock counts</BackLink>
      <h1 className="text-2xl font-bold text-brand">Start a stock count</h1>
      <StartCountForm products={products} lowStockDefault={settings.low_stock_default} />
    </section>
  );
}
