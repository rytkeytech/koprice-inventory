import "server-only";

import { createClient } from "@/lib/supabase/server";

export type Pack = {
  id: string;
  name: string;
  units_per_pack: number;
  barcode: string | null;
  retail_price: number;
  wholesale_price: number;
  min_wholesale_qty: number;
  is_quick_sell: boolean;
  is_active: boolean;
};

export type Product = {
  id: string;
  name: string;
  category_id: string | null;
  brand: string | null;
  base_unit_name: string;
  barcode: string | null;
  retail_price: number;
  wholesale_price: number;
  min_wholesale_qty: number;
  stock_units: number;
  reorder_level: number;
  is_quick_sell: boolean;
  photo_url: string | null;
  is_active: boolean;
  packs: Pack[];
};

export type Category = { id: string; name: string; sort_order: number; is_active: boolean };

const PRODUCT_COLUMNS =
  "id, name, category_id, brand, base_unit_name, barcode, retail_price, wholesale_price, min_wholesale_qty, stock_units, reorder_level, is_quick_sell, photo_url, is_active, product_packs(id, name, units_per_pack, barcode, retail_price, wholesale_price, min_wholesale_qty, is_quick_sell, is_active)";

type ProductRow = Omit<Product, "packs" | "retail_price" | "wholesale_price"> & {
  retail_price: number | string;
  wholesale_price: number | string;
  product_packs: (Omit<Pack, "retail_price" | "wholesale_price"> & {
    retail_price: number | string;
    wholesale_price: number | string;
  })[];
};

function toProduct(row: ProductRow): Product {
  const { product_packs, ...rest } = row;
  return {
    ...rest,
    retail_price: Number(rest.retail_price),
    wholesale_price: Number(rest.wholesale_price),
    packs: (product_packs ?? [])
      .map((p) => ({ ...p, retail_price: Number(p.retail_price), wholesale_price: Number(p.wholesale_price) }))
      .sort((a, b) => a.units_per_pack - b.units_per_pack),
  };
}

/** All products with their packs, sorted by name. RLS decides who can read. */
export async function getProducts(options: { activeOnly?: boolean } = {}) {
  const supabase = await createClient();
  let query = supabase.from("products").select(PRODUCT_COLUMNS).order("name");
  if (options.activeOnly) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) throw new Error(`Could not load products: ${error.message}`);
  return (data as unknown as ProductRow[]).map(toProduct);
}

export async function getProduct(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("products").select(PRODUCT_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`Could not load product: ${error.message}`);
  return data ? toProduct(data as unknown as ProductRow) : null;
}

export async function getCategories(options: { activeOnly?: boolean } = {}) {
  const supabase = await createClient();
  let query = supabase.from("categories").select("id, name, sort_order, is_active").order("sort_order").order("name");
  if (options.activeOnly) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) throw new Error(`Could not load categories: ${error.message}`);
  return data as Category[];
}

/** Cost per base unit by product id. Owner only (RLS returns nothing for others). */
export async function getCosts() {
  const supabase = await createClient();
  const { data } = await supabase.from("product_costs").select("product_id, cost_per_unit");
  return new Map((data ?? []).map((c) => [c.product_id, Number(c.cost_per_unit)]));
}

export async function getShopSettings() {
  const supabase = await createClient();
  const { data } = await supabase.from("shop_settings").select("*").maybeSingle();
  return {
    shop_name: data?.shop_name ?? "Koprice Enterprise",
    phone: data?.phone ?? null,
    location: data?.location ?? null,
    momo_number: data?.momo_number ?? null,
    momo_name: data?.momo_name ?? null,
    receipt_footer: data?.receipt_footer ?? null,
    low_stock_default: data?.low_stock_default ?? 10,
  };
}
