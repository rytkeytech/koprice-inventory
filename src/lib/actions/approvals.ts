"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true; message?: string } | { ok: false; error: string };

// Messages from the database that are safe to show as they are.
function friendly(message: string, fallback: string) {
  const known = message.match(
    /(Give a reason.*|There is already a request waiting.*|This sale is .*|Only completed sales.*|Not enough stock for .*|This request was already .*|Enter how many units|Add a note saying what happened|Choose .*|Enter the new prices|Sale not found|Product not found|Only the owner.*)/,
  );
  return known?.[0] ?? fallback;
}

export async function decideRequest(requestId: string, approve: boolean, reason: string): Promise<Result> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("decide_approval", {
    p_request_id: requestId,
    p_approve: approve,
    p_reason: reason.trim() || undefined,
  });
  if (error) return { ok: false, error: friendly(error.message, "Could not save the decision. Please try again.") };
  refresh();
  const r = data as { money_returned?: number };
  return { ok: true, message: r.money_returned ? `Give back GH₵ ${Number(r.money_returned).toFixed(2)} to the customer.` : undefined };
}

export async function reverseSale(saleId: string, kind: "refund" | "void", reason: string): Promise<Result> {
  if (!reason.trim()) return { ok: false, error: "Give a reason." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(kind === "refund" ? "refund_sale" : "void_sale", {
    p_sale_id: saleId,
    p_reason: reason.trim(),
  });
  if (error) return { ok: false, error: friendly(error.message, "Could not save. Please try again.") };
  refresh();
  const r = data as { money_returned: number; credit_reversed: number };
  const parts = [];
  if (Number(r.money_returned) > 0) parts.push(`Give back GH₵ ${Number(r.money_returned).toFixed(2)} to the customer.`);
  if (Number(r.credit_reversed) > 0) parts.push(`GH₵ ${Number(r.credit_reversed).toFixed(2)} taken off their credit.`);
  return { ok: true, message: parts.join(" ") || undefined };
}

export async function requestApproval(type: "refund" | "void_sale" | "stock_adjustment" | "price_change", payload: Record<string, unknown>): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_approval", { p_type: type, p_payload: payload as never });
  if (error) return { ok: false, error: friendly(error.message, "Could not send the request. Please try again.") };
  refresh();
  return { ok: true, message: "Sent to the owner." };
}

export async function adjustStock(productId: string, change: number, reason: string, note: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("adjust_stock", {
    p_product_id: productId,
    p_change: change,
    p_reason: reason,
    p_note: note,
  });
  if (error) return { ok: false, error: friendly(error.message, "Could not save. Please try again.") };
  refresh();
  return { ok: true, message: "Stock updated." };
}
