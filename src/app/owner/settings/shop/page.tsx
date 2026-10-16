import type { Metadata } from "next";
import { BackLink } from "@/components/BackLink";
import { getShopSettings } from "@/lib/catalogue";
import { ShopForm } from "./ShopForm";

export const metadata: Metadata = { title: "Shop details" };

export default async function ShopSettingsPage() {
  const s = await getShopSettings();
  return (
    <section className="mx-auto max-w-xl space-y-4">
      <BackLink href="/owner/settings">Settings</BackLink>
      <h1 className="text-2xl font-bold text-brand">Shop details</h1>
      <div className="rounded-card border border-line bg-card p-4">
        <ShopForm
          initial={{
            shop_name: s.shop_name,
            phone: s.phone ?? "",
            location: s.location ?? "",
            momo_number: s.momo_number ?? "",
            momo_name: s.momo_name ?? "",
            receipt_footer: s.receipt_footer ?? "",
            low_stock_default: s.low_stock_default,
          }}
        />
      </div>
    </section>
  );
}
