"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type SupplierInput = { name: string; phone: string; notes: string; is_active: boolean };

function friendly(message: string) {
  if (message.includes("suppliers_name_key")) return "A supplier with that name already exists.";
  return "Could not save. Please try again.";
}

export async function saveSupplier(id: string | null, input: SupplierInput): Promise<{ ok: boolean; error?: string }> {
  const name = input.name.trim();
  if (name.length < 2) return { ok: false, error: "Enter the supplier's name." };
  const row = { name, phone: input.phone.trim() || null, notes: input.notes.trim() || null };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("suppliers").update({ ...row, is_active: input.is_active }).eq("id", id)
    : await supabase.from("suppliers").insert(row);
  if (error) return { ok: false, error: friendly(error.message) };
  refresh();
  return { ok: true };
}
