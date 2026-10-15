"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type CategoryState = { error?: string; done?: string };

function friendly(message: string) {
  if (message.includes("categories_name_key")) return "A category with that name already exists.";
  if (message.includes("row-level security")) return "Only the owner can change categories.";
  return "Could not save. Please try again.";
}

export async function addCategory(_prev: CategoryState, formData: FormData): Promise<CategoryState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Type a category name." };
  const supabase = await createClient();
  const { data: last } = await supabase
    .from("categories")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase.from("categories").insert({ name, sort_order: (last?.sort_order ?? 0) + 10 });
  if (error) return { error: friendly(error.message) };
  refresh();
  return { done: `Added "${name}".` };
}

export async function updateCategory(
  id: string,
  patch: { name?: string; sort_order?: number; is_active?: boolean },
): Promise<CategoryState> {
  if (patch.name !== undefined && !patch.name.trim()) return { error: "Name can't be empty." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("categories")
    .update({ ...patch, name: patch.name?.trim() })
    .eq("id", id);
  if (error) return { error: friendly(error.message) };
  refresh();
  return { done: "Saved." };
}
