"use client";

import { Camera, LoaderCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { FormAlert } from "@/components/ui/form";
import { addExpense, decideExpense } from "@/lib/actions/expenses";
import { EXPENSE_CATEGORIES, type ExpenseCategory } from "@/lib/expense-categories";
import { compressImage, extensionFor } from "@/lib/image";
import { createClient } from "@/lib/supabase/client";

const input = "h-12 w-full rounded-control border border-input bg-card px-3 text-base";
const LABELS: Record<ExpenseCategory, string> = {
  rent: "Rent",
  electricity: "Electricity",
  transport: "Transport",
  salary: "Salary",
  other: "Other",
};

export function ExpenseForm({ userId, today, isOwner }: { userId: string; today: string; isOwner: boolean }) {
  const [category, setCategory] = useState<ExpenseCategory>("transport");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [receiptPath, setReceiptPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState<string>();
  const [saving, startSaving] = useTransition();

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const blob = await compressImage(file, 1400);
      const path = `${userId}/expense-${crypto.randomUUID()}.${extensionFor(blob)}`;
      const { error: e } = await createClient().storage.from("invoices").upload(path, blob, { contentType: blob.type });
      if (e) throw e;
      setReceiptPath(path);
    } catch {
      setError("Could not upload the photo.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-3">
      {done && <FormAlert message={done} />}
      <div className="grid grid-cols-2 gap-3">
        <label className="block space-y-1">
          <span className="font-semibold">What for</span>
          <select className={input} value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)}>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {LABELS[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="font-semibold">Amount (GH₵)</span>
          <input className={input} type="number" inputMode="decimal" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <label className="block space-y-1">
          <span className="font-semibold">Date</span>
          <input className={input} type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="flex h-12 cursor-pointer items-center justify-center gap-2 self-end rounded-control border border-input font-semibold">
          {uploading ? <LoaderCircle aria-hidden="true" className="size-5 animate-spin" /> : <Camera aria-hidden="true" className="size-5" />}
          {receiptPath ? "Photo added" : "Receipt photo"}
          <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => onPhoto(e.target.files?.[0])} />
        </label>
      </div>
      <label className="block space-y-1">
        <span className="font-semibold">Details</span>
        <input className={input} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Taxi to Voltic depot" />
      </label>
      <FormAlert error={error} />
      <button
        type="button"
        disabled={saving || uploading}
        onClick={() =>
          startSaving(async () => {
            setError(undefined);
            const r = await addExpense({ category, amount: Number(amount), expenseDate: date, note, receiptPath });
            if (!r.ok) return setError(r.error);
            setDone(isOwner ? "Expense saved." : "Expense sent to the owner.");
            setAmount("");
            setNote("");
            setReceiptPath(null);
          })
        }
        className="flex h-14 w-full items-center justify-center gap-2 rounded-control bg-brand text-lg font-bold text-white disabled:opacity-60"
      >
        {saving && <LoaderCircle aria-hidden="true" className="size-5 animate-spin" />}
        {isOwner ? "Save expense" : "Send to owner"}
      </button>
    </div>
  );
}

export function ExpenseDecision({ id }: { id: string }) {
  const [error, setError] = useState<string>();
  const [saving, startSaving] = useTransition();
  const run = (status: "confirmed" | "rejected") =>
    startSaving(async () => {
      const r = await decideExpense(id, status);
      if (!r.ok) setError(r.error);
    });
  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <button type="button" disabled={saving} onClick={() => run("rejected")} className="h-11 rounded-control border border-danger/40 px-3 text-sm font-semibold text-danger disabled:opacity-60">
          Reject
        </button>
        <button type="button" disabled={saving} onClick={() => run("confirmed")} className="h-11 rounded-control bg-brand px-3 text-sm font-semibold text-white disabled:opacity-60">
          Confirm
        </button>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
