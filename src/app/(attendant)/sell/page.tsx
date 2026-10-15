import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { getCategories, getProducts, getShopSettings } from "@/lib/catalogue";
import { createClient } from "@/lib/supabase/server";
import { SellScreen } from "./SellScreen";
import type { SellCustomer } from "@/lib/sell-options";

export const metadata: Metadata = { title: "Sell" };

export default async function SellPage() {
  const supabase = await createClient();
  const [products, categories, shop, user, customersResult] = await Promise.all([
    getProducts({ activeOnly: true }),
    getCategories({ activeOnly: true }),
    getShopSettings(),
    getCurrentUser(),
    supabase
      .from("customers")
      .select("id, name, phone, type, balance, credit_limit")
      .eq("is_active", true)
      .order("name"),
  ]);

  const customers: SellCustomer[] = (customersResult.data ?? []).map((c) => ({
    ...c,
    type: c.type as SellCustomer["type"],
    balance: Number(c.balance),
    credit_limit: Number(c.credit_limit),
  }));

  return (
    <SellScreen
      products={products}
      categories={categories}
      customers={customers}
      shop={shop}
      isOwner={user?.role === "owner"}
    />
  );
}
