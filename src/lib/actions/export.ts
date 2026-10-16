"use server";

import { createClient } from "@/lib/supabase/server";

export type ExportSale = {
  receipt_no: string;
  created_at: string;
  status: string;
  price_mode: string;
  attendant: string;
  customer: string;
  total: number;
  discount: number;
  cash: number;
  momo: number;
  credit: number;
  momo_txn_id: string;
};

/** Every sale in a period, for the Excel download (owner only via RLS). */
export async function salesForExport(from: string, to: string): Promise<ExportSale[]> {
  const supabase = await createClient();
  const start = new Date(`${from}T00:00:00Z`).toISOString(); // Accra is UTC+0
  const end = new Date(new Date(`${to}T00:00:00Z`).getTime() + 86400000).toISOString();
  const { data } = await supabase
    .from("sales")
    .select("receipt_no, created_at, status, price_mode, total, discount, paid_cash, change_given, paid_momo, credit_amount, momo_txn_id, profiles!sales_attendant_id_fkey(full_name), customers(name)")
    .gte("created_at", start)
    .lt("created_at", end)
    .order("created_at")
    .limit(20000);
  return (data ?? []).map((s) => ({
    receipt_no: s.receipt_no,
    created_at: s.created_at,
    status: s.status,
    price_mode: s.price_mode,
    attendant: s.profiles?.full_name ?? "",
    customer: s.customers?.name ?? "",
    total: Number(s.total),
    discount: Number(s.discount),
    cash: Number(s.paid_cash) - Number(s.change_given),
    momo: Number(s.paid_momo),
    credit: Number(s.credit_amount),
    momo_txn_id: s.momo_txn_id ?? "",
  }));
}
