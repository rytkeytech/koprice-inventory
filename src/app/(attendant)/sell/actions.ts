"use server";

import { refresh } from "next/cache";
import type { Receipt } from "@/lib/receipt";
import { createClient } from "@/lib/supabase/server";
import { checkFullName, checkPhone, normalisePhone } from "@/lib/validation";

export type SaleRequest = {
  items: { product_id: string; pack_id: string | null; qty: number }[];
  priceMode: "retail" | "wholesale";
  customerId: string | null;
  payment: { cash: number; momo: number; momo_txn_id: string; credit: number };
  discount: number;
  clientRef: string;
  note: string;
};

export type SaleResult = { ok: true; receipt: Receipt } | { ok: false; error: string };

// Database messages that are already plain English and safe to show.
const SHOWABLE = [
  /Not enough stock for .*/,
  /Not enough cash: .*/,
  /Enter the MoMo transaction ID/,
  /MoMo and credit add up to more than the total/,
  /Choose a customer to give credit/,
  /Give a reason for the owner/,
  /Discount must be .*/,
  /.* is no longer for sale/,
  /Only approved staff can sell/,
  /Customer not found/,
];

function friendlySaleError(message: string) {
  for (const pattern of SHOWABLE) {
    const match = message.match(pattern);
    if (match) return match[0];
  }
  if (/fetch failed|network/i.test(message)) return "No internet connection. Check the data and try again.";
  return "The sale could not be saved. Please try again.";
}

/** Sends the sale to complete_sale(). Prices are worked out by the database. */
export async function completeSale(sale: SaleRequest): Promise<SaleResult> {
  if (sale.items.length === 0) return { ok: false, error: "Add something to the sale first." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("complete_sale", {
    p_items: sale.items.map(({ product_id, pack_id, qty }) => ({ product_id, pack_id, qty })),
    p_price_mode: sale.priceMode,
    p_customer_id: sale.customerId ?? undefined,
    p_payment: sale.payment,
    p_discount: sale.discount,
    p_client_ref: sale.clientRef,
    p_note: sale.note || undefined,
  });
  if (error) return { ok: false, error: friendlySaleError(error.message) };

  refresh();
  return { ok: true, receipt: data as unknown as Receipt };
}

export type NewCustomer = {
  id: string;
  name: string;
  phone: string | null;
  type: "retail" | "wholesale";
  balance: number;
  credit_limit: number;
};

/** Staff can add a customer (with no credit limit; the owner sets limits). */
export async function addCustomer(input: {
  name: string;
  phone: string;
  type: "retail" | "wholesale";
}): Promise<{ ok: true; customer: NewCustomer } | { ok: false; error: string }> {
  const name = input.name.trim();
  const nameError = checkFullName(name);
  if (nameError) return { ok: false, error: "Enter the customer's name." };
  const phone = input.phone.trim() ? normalisePhone(input.phone) : null;
  if (phone && checkPhone(phone)) return { ok: false, error: "That phone number doesn't look right." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .insert({ name, phone, type: input.type })
    .select("id, name, phone, type, balance, credit_limit")
    .single();
  if (error) return { ok: false, error: "Could not add the customer. Please try again." };

  return {
    ok: true,
    customer: {
      ...data,
      type: data.type as NewCustomer["type"],
      balance: Number(data.balance),
      credit_limit: Number(data.credit_limit),
    },
  };
}
