import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/PagePlaceholder";

export const metadata: Metadata = { title: "Stock" };

export default function StockPage() {
  return (
    <PagePlaceholder
      title="Stock"
      description="Products, packs, prices, stock levels, stock counts and Excel import."
      phase={3}
    />
  );
}
