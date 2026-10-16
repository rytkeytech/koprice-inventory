"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

function friendly(message: string, fallback: string) {
  const known = message.match(
    /(You have already closed this day|You can only close today or the last 7 days|Choose how you are handing over the cash|Enter the amount.*|This cash-up was already checked|Only the owner.*)/,
  );
  return known?.[0] ?? fallback;
}

export async function closeDay(input: {
  businessDate: string;
  method: "momo" | "safe";
  amount: number;
  momoTxnId: string;
  note: string;
}): Promise<Result> {
  if (input.method === "momo" && input.amount > 0 && !input.momoTxnId.trim()) {
    return { ok: false, error: "Enter the MoMo transaction ID for the money you sent." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_cash_up", {
    p_business_date: input.businessDate,
    p_method: input.method,
    p_amount: input.amount,
    p_momo_txn_id: input.momoTxnId || undefined,
    p_note: input.note || undefined,
  });
  if (error) return { ok: false, error: friendly(error.message, "Could not close the day. Please try again.") };
  refresh();
  return { ok: true };
}

export async function confirmCashUp(id: string, amount: number, note: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("confirm_cash_up", {
    p_cash_up_id: id,
    p_confirmed_amount: amount,
    p_note: note || undefined,
  });
  if (error) return { ok: false, error: friendly(error.message, "Could not save. Please try again.") };
  refresh();
  return { ok: true };
}
