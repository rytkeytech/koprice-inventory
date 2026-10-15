"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function checkDelivery(input: {
  deliveryId: string;
  status: "confirmed" | "queried";
  costs: { delivery_item_id: string; cost_per_unit: number | null }[];
  note: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("confirm_delivery", {
    p_delivery_id: input.deliveryId,
    p_costs: input.costs.filter((c) => c.cost_per_unit !== null),
    p_status: input.status,
    p_note: input.note || undefined,
  });
  if (error) {
    const known = error.message.match(/(Say what is wrong with the delivery|This delivery is already confirmed|Cost cannot be negative)/);
    return { ok: false, error: known?.[0] ?? "Could not save. Please try again." };
  }
  refresh();
  return { ok: true };
}
