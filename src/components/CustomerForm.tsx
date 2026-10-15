"use client";

import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FormAlert } from "@/components/ui/form";
import { createCustomer, updateCustomer, type CustomerInput } from "@/lib/actions/credit";

type Props = {
  customer?: CustomerInput & { id: string; is_active: boolean };
  onSaved?: () => void;
};

const input = "h-12 w-full rounded-control border border-input bg-card px-3 text-base";

/** Owner form to add or edit a customer, including their credit limit. */
export function CustomerForm({ customer, onSaved }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<CustomerInput>({
    name: customer?.name ?? "",
    phone: customer?.phone ?? "",
    type: customer?.type ?? "retail",
    credit_limit: customer?.credit_limit ?? 0,
    notes: customer?.notes ?? "",
    is_active: customer?.is_active ?? true,
  });
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [saving, startSaving] = useTransition();
  const set = <K extends keyof CustomerInput>(key: K, value: CustomerInput[K]) => {
    setSaved(false);
    setForm((f) => ({ ...f, [key]: value }));
  };

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(undefined);
        startSaving(async () => {
          if (customer) {
            const r = await updateCustomer(customer.id, form);
            if (!r.ok) return setError(r.error);
            setSaved(true);
          } else {
            const r = await createCustomer(form);
            if (!r.ok) return setError(r.error);
            router.push(`/owner/money/customers/${r.id}`);
          }
          onSaved?.();
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-sm font-semibold">Name</span>
          <input className={input} value={form.name} onChange={(e) => set("name", e.target.value)} required />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-semibold">Phone</span>
          <input className={input} type="tel" inputMode="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="024 123 4567" />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-semibold">Type</span>
          <select className={input} value={form.type} onChange={(e) => set("type", e.target.value as CustomerInput["type"])}>
            <option value="retail">Retail</option>
            <option value="wholesale">Wholesale</option>
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-semibold">Credit limit (GH₵)</span>
          <input className={input} type="number" inputMode="decimal" step="0.01" min="0" value={form.credit_limit} onChange={(e) => set("credit_limit", Number(e.target.value) || 0)} />
          <span className="block text-sm text-muted">0 = attendants can&apos;t give credit without your approval.</span>
        </label>
      </div>
      <label className="block space-y-1">
        <span className="text-sm font-semibold">Notes</span>
        <input className={input} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
      </label>
      {customer && (
        <label className="flex min-h-11 items-center gap-3 font-semibold">
          <input type="checkbox" className="size-5 accent-brand" checked={form.is_active} onChange={(e) => set("is_active", e.target.checked)} />
          Active (untick to hide this customer)
        </label>
      )}
      <FormAlert error={error} message={saved ? "Saved." : undefined} />
      <button type="submit" disabled={saving} className="flex h-12 w-full items-center justify-center gap-2 rounded-control bg-brand font-bold text-white disabled:opacity-60">
        {saving && <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />}
        {customer ? "Save changes" : "Add customer"}
      </button>
    </form>
  );
}
