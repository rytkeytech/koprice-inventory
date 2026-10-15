"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type DeliveryInput = {
  supplierId: string | null;
  items: { product_id: string; pack_id: string | null; qty: number; cost_per_unit: number | null }[];
  photoPath: string | null;
  note: string;
  clientRef: string;
};

export async function recordDelivery(
  input: DeliveryInput,
): Promise<{ ok: true; status: string; deliveryId: string } | { ok: false; error: string }> {
  if (input.items.length === 0) return { ok: false, error: "Add at least one item." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("record_delivery", {
    p_supplier_id: input.supplierId ?? undefined,
    p_items: input.items,
    p_photo_path: input.photoPath ?? undefined,
    p_note: input.note || undefined,
    p_client_ref: input.clientRef,
  });
  if (error) {
    const known = error.message.match(/(Quantity must be at least 1|Add at least one item|Supplier not found|Only approved staff.*)/);
    return { ok: false, error: known?.[0] ?? "Could not save the delivery. Please try again." };
  }
  refresh();
  const result = data as { delivery_id: string; status: string };
  return { ok: true, status: result.status, deliveryId: result.delivery_id };
}

export async function addSupplier(name: string, phone: string): Promise<{ ok: true; id: string; name: string } | { ok: false; error: string }> {
  const clean = name.trim();
  if (clean.length < 2) return { ok: false, error: "Enter the supplier's name." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("suppliers")
    .insert({ name: clean, phone: phone.trim() || null })
    .select("id, name")
    .single();
  if (error) {
    return {
      ok: false,
      error: error.message.includes("suppliers_name_key") ? "That supplier already exists. Pick it from the list." : "Could not add the supplier.",
    };
  }
  return { ok: true, id: data.id, name: data.name };
}
