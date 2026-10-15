"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type PackInput = {
  id?: string;
  name: string;
  units_per_pack: number;
  barcode: string;
  retail_price: string;
  wholesale_price: string;
  min_wholesale_qty: number;
  is_quick_sell: boolean;
  is_active: boolean;
};

export type ProductInput = {
  id?: string;
  name: string;
  category_id: string;
  brand: string;
  base_unit_name: string;
  barcode: string;
  retail_price: string;
  wholesale_price: string;
  min_wholesale_qty: number;
  reorder_level: number;
  is_quick_sell: boolean;
  is_active: boolean;
  photo_url: string;
  cost_per_unit: string;
  opening_stock: number;
  packs: PackInput[];
};

/** Plain-English messages for database errors a person can fix. */
export async function friendlyDbError(message: string) {
  if (message.includes("products_barcode_key") || message.includes("product_packs_barcode_key"))
    return "That barcode is already used by another item.";
  if (message.includes("already used by")) return message.replace(/^.*?Barcode/, "Barcode");
  if (message.includes("product_packs_name_key")) return "Two packs have the same name.";
  if (message.includes("units_per_pack")) return "A pack must hold more than 1 unit.";
  if (message.includes("retail_price") || message.includes("wholesale_price"))
    return "Prices must be more than 0.";
  if (message.includes("Only the owner")) return "Only the owner can do this.";
  return "Could not save. Please check the details and try again.";
}

export async function saveProduct(input: ProductInput): Promise<{ error: string } | void> {
  const name = input.name.trim();
  if (!name) return { error: "Enter the product name." };
  if (!(Number(input.retail_price) > 0) || !(Number(input.wholesale_price) > 0))
    return { error: "Enter a retail and wholesale price above 0." };
  for (const pack of input.packs) {
    if (!pack.name.trim()) return { error: "Every pack needs a name, e.g. Bag or Carton." };
    if (!(pack.units_per_pack > 1)) return { error: `"${pack.name}" must hold more than 1 unit.` };
    if (!(Number(pack.retail_price) > 0) || !(Number(pack.wholesale_price) > 0))
      return { error: `Enter prices for "${pack.name}".` };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_product", {
    p: {
      ...input,
      id: input.id || null,
      name,
      cost_per_unit: input.cost_per_unit.trim() === "" ? null : input.cost_per_unit,
      packs: input.packs.map((p) => ({ ...p, id: p.id || null })),
    },
  });
  if (error) return { error: await friendlyDbError(error.message) };

  redirect(`/owner/stock/${data}`);
}

/** Quick show/hide from the product page. */
export async function setProductActive(productId: string, active: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("products").update({ is_active: active }).eq("id", productId);
  if (error) return { error: await friendlyDbError(error.message) };
  refresh();
}
