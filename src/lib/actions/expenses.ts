"use server";

import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import type { ExpenseCategory } from "@/lib/expense-categories";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

export async function addExpense(input: {
  category: ExpenseCategory;
  amount: number;
  expenseDate: string;
  note: string;
  receiptPath: string | null;
}): Promise<Result> {
  if (!(input.amount > 0)) return { ok: false, error: "Enter the amount." };
  if (input.category === "other" && !input.note.trim()) return { ok: false, error: "Say what the expense was for." };
  const user = await getCurrentUser();
  if (input.receiptPath && !input.receiptPath.startsWith(`${user?.id}/`)) return { ok: false, error: "Invalid photo." };

  const supabase = await createClient();
  const { error } = await supabase.from("expenses").insert({
    category: input.category,
    amount: Math.round(input.amount * 100) / 100,
    expense_date: input.expenseDate,
    note: input.note.trim() || null,
    receipt_photo_url: input.receiptPath,
    // The owner's own expenses count at once; staff expenses wait for the owner.
    status: user?.role === "owner" ? "confirmed" : "pending",
  });
  if (error) return { ok: false, error: "Could not save the expense. Please try again." };
  refresh();
  return { ok: true };
}

export async function decideExpense(id: string, status: "confirmed" | "rejected"): Promise<Result> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("expenses").update({ status }).eq("id", id).select("id");
  if (error || !data?.length) return { ok: false, error: "Only the owner can do this." };
  refresh();
  return { ok: true };
}
