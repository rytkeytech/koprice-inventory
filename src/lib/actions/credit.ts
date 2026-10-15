"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkPhone, normalisePhone } from "@/lib/validation";

export type PaymentResult =
  | { ok: true; customerName: string; amount: number; balance: number }
  | { ok: false; error: string };

/** Customer pays back credit. Works for attendants and the owner. */
export async function recordCreditPayment(input: {
  customerId: string;
  amount: number;
  method: "cash" | "momo";
  momoTxnId: string;
  note: string;
}): Promise<PaymentResult> {
  if (!input.customerId) return { ok: false, error: "Choose the customer who is paying." };
  if (!(input.amount > 0)) return { ok: false, error: "Enter the amount paid." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("record_credit_payment", {
    p_customer_id: input.customerId,
    p_amount: input.amount,
    p_method: input.method,
    p_momo_txn_id: input.momoTxnId || undefined,
    p_note: input.note || undefined,
  });
  if (error) {
    const known = error.message.match(/(.* only owes GH₵ [\d.]+|Enter the MoMo transaction ID|Enter the amount paid)/);
    return { ok: false, error: known?.[0] ?? "Could not save the payment. Please try again." };
  }
  refresh();
  const result = data as { customer_name: string; amount: number; balance: number };
  return { ok: true, customerName: result.customer_name, amount: Number(result.amount), balance: Number(result.balance) };
}

export type CustomerInput = {
  name: string;
  phone: string;
  type: "retail" | "wholesale";
  credit_limit: number;
  notes: string;
  is_active?: boolean;
};

function cleanCustomer(input: CustomerInput) {
  const name = input.name.trim();
  if (name.length < 2) return { ok: false as const, error: "Enter the customer's name." };
  const phone = input.phone.trim() ? normalisePhone(input.phone) : null;
  if (phone && checkPhone(phone)) return { ok: false as const, error: "That phone number doesn't look right." };
  if (!(input.credit_limit >= 0)) return { ok: false as const, error: "Credit limit can't be negative." };
  return {
    ok: true as const,
    value: {
      name,
      phone,
      type: input.type,
      credit_limit: Math.round(input.credit_limit * 100) / 100,
      notes: input.notes.trim() || null,
    },
  };
}

/** Owner adds a customer (attendants use the Sell screen, with no credit limit). */
export async function createCustomer(input: CustomerInput): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const clean = cleanCustomer(input);
  if (!clean.ok) return { ok: false, error: clean.error };
  const supabase = await createClient();
  const { data, error } = await supabase.from("customers").insert(clean.value).select("id").single();
  if (error) return { ok: false, error: "Could not add the customer. Please try again." };
  refresh();
  return { ok: true, id: data.id };
}

export async function updateCustomer(id: string, input: CustomerInput): Promise<{ ok: true } | { ok: false; error: string }> {
  const clean = cleanCustomer(input);
  if (!clean.ok) return { ok: false, error: clean.error };
  const supabase = await createClient();
  const { error } = await supabase
    .from("customers")
    .update({ ...clean.value, is_active: input.is_active ?? true })
    .eq("id", id);
  if (error) return { ok: false, error: "Could not save. Only the owner can edit customers." };
  refresh();
  return { ok: true };
}
