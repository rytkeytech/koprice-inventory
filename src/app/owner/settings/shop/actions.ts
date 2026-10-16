"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ShopSettingsInput = {
  shop_name: string;
  phone: string;
  location: string;
  momo_number: string;
  momo_name: string;
  receipt_footer: string;
  low_stock_default: number;
};

export async function saveShopSettings(input: ShopSettingsInput): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!input.shop_name.trim()) return { ok: false, error: "Enter the shop name." };
  const clean = (v: string) => v.trim() || null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shop_settings")
    .update({
      shop_name: input.shop_name.trim(),
      phone: clean(input.phone),
      location: clean(input.location),
      momo_number: clean(input.momo_number),
      momo_name: clean(input.momo_name),
      receipt_footer: clean(input.receipt_footer),
      low_stock_default: Math.max(0, Math.round(input.low_stock_default)),
    })
    .eq("singleton", true)
    .select("id");
  if (error || !data?.length) return { ok: false, error: "Could not save. Only the owner can change shop details." };
  refresh();
  return { ok: true };
}
