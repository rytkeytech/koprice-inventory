"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

function friendly(message: string, fallback: string) {
  const known = message.match(
    /(Choose .*|No products to count|Enter how many you counted.*|This stock count is .*|This product is not part of the count|Not enough stock for .*|Only the owner.*)/,
  );
  return known?.[0] ?? fallback;
}

export async function startCount(type: "spot" | "full", productIds: string[], note: string): Promise<Result> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_stock_count", {
    p_type: type,
    p_product_ids: type === "spot" ? productIds : undefined,
    p_note: note || undefined,
  });
  if (error) return { ok: false, error: friendly(error.message, "Could not start the count.") };
  redirect(`/owner/stock/counts/${data}`);
}

export async function saveCount(countId: string, productId: string, units: number): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_count_item", {
    p_count_id: countId,
    p_product_id: productId,
    p_counted_units: units,
  });
  if (error) return { ok: false, error: friendly(error.message, "Could not save. Please try again.") };
  return { ok: true };
}

export async function finishCount(countId: string, apply: boolean): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_stock_count", { p_count_id: countId, p_apply: apply });
  if (error) return { ok: false, error: friendly(error.message, "Could not finish the count.") };
  refresh();
  return { ok: true };
}
