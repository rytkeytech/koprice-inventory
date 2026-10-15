"use server";

import type { ImportRow } from "@/lib/import-products";
import { createClient } from "@/lib/supabase/server";

export type ImportResult =
  | { ok: true; created: number; updated: number; stockNotChanged: string[] }
  | { ok: false; error: string };

export async function importProducts(rows: ImportRow[]): Promise<ImportResult> {
  if (rows.length === 0) return { ok: false, error: "There are no rows to import." };
  if (rows.length > 2000) return { ok: false, error: "Please import at most 2,000 products at a time." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("import_products", { p_rows: rows });
  if (error) {
    // The database says which row failed, e.g. "Row 12: unknown category ...".
    const message = error.message.match(/Row \d+:.*/)?.[0];
    return { ok: false, error: message ?? "The import failed. Nothing was saved. Please check the file." };
  }

  const result = data as { created: number; updated: number; stock_not_changed: string[] };
  return {
    ok: true,
    created: result.created,
    updated: result.updated,
    stockNotChanged: result.stock_not_changed,
  };
}
